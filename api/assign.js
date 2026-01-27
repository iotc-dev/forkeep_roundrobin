import { redis } from '../lib/redis.js';
import { TEAMS } from '../lib/teams-config.js';


// Helper: Get member active status from Redis (falls back to config default)
async function isActiveMember(teamKey, member) {
  const key = `member-active:${teamKey}:${member.id}`;
  const value = await redis.get(key);
  
  if (value !== null) {
    return value === 'true';
  }
  return member.defaultActive;
}


// ==============================
// ASSIGNMENT HANDLER WITH ATOMIC OPERATIONS
// ==============================
export default async function handler(req, res) {
  // Enforce POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Use POST'
    });
  }

  try {
    const { contactId, team: teamKey } = req.body;

    // ------------------------------
    // VALIDATION
    // ------------------------------
    if (!contactId) {
      return res.status(400).json({
        error: 'Missing contactId',
        message: 'Request body must include contactId'
      });
    }

    if (!teamKey) {
      return res.status(400).json({
        error: 'Missing team',
        message: 'Request body must include team identifier'
      });
    }

    const team = TEAMS[teamKey];
    if (!team) {
      return res.status(404).json({
        error: 'Team not found',
        message: `Team '${teamKey}' does not exist`,
        availableTeams: Object.keys(TEAMS)
      });
    }

    if (!Array.isArray(team.members) || team.members.length === 0) {
      return res.status(400).json({
        error: 'No team members',
        message: `Team '${teamKey}' has no members configured`
      });
    }

    // ------------------------------
    // CHECK EXISTING OWNER - EARLY EXIT
    // ------------------------------
    const checkOwnerResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=hubspot_owner_id`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!checkOwnerResponse.ok) {
      const errorText = await checkOwnerResponse.text();
      throw new Error(`HubSpot API error (${checkOwnerResponse.status}): ${errorText}`);
    }

    const contactData = await checkOwnerResponse.json();
    const existingOwnerId = contactData.properties?.hubspot_owner_id;

    if (existingOwnerId) {
      console.log(
        `[${teamKey}] ⚠️  Contact ${contactId} already has owner ${existingOwnerId} - skipping (no Redis update)`
      );

      // Return immediately - don't touch Redis at all
      return res.status(200).json({
        success: true,
        skipped: true,
        contactId,
        team: team.name,
        message: 'Contact already has an owner - assignment skipped',
        existingOwnerId,
        timestamp: new Date().toISOString()
      });
    }

    console.log(
      `[${teamKey}] ✓ Contact ${contactId} is new - proceeding with assignment`
    );

    // ------------------------------
    // GET ACTIVE MEMBERS FROM REDIS
    // ------------------------------
    const activeMembers = [];
    for (const member of team.members) {
      const isActive = await isActiveMember(teamKey, member);
      if (isActive) {
        activeMembers.push(member);
      }
    }

    console.log(
      `[${teamKey}] ${team.members.length} total | ${activeMembers.length} active`
    );

    if (activeMembers.length === 0) {
      return res.status(400).json({
        error: 'No active members',
        message: `Team '${teamKey}' has no active members`,
        hint: 'Use the admin dashboard to activate at least one member'
      });
    }

    // ------------------------------
    // ATOMIC ROUND-ROBIN WITH LUA SCRIPT
    // ------------------------------
    
    // Create list of active member IDs
    const activeMemberIds = activeMembers.map(m => m.id);
    
    // Lua script for atomic get-and-increment
    const luaScript = `
      local lastAssignedKey = KEYS[1]
      local activeMemberIds = cjson.decode(ARGV[1])
      
      -- Get last assigned ID
      local lastAssignedId = redis.call('GET', lastAssignedKey)
      
      -- Find next index
      local nextIndex = 1
      if lastAssignedId then
        for i, id in ipairs(activeMemberIds) do
          if tostring(id) == tostring(lastAssignedId) then
            nextIndex = (i % #activeMemberIds) + 1
            break
          end
        end
      end
      
      -- Get next member ID
      local nextMemberId = activeMemberIds[nextIndex]
      
      -- Update last assigned atomically
      redis.call('SET', lastAssignedKey, nextMemberId)
      
      -- Return the selected member ID and index
      return {nextMemberId, nextIndex - 1}
    `;

    // Execute Lua script atomically
    const lastAssignedKey = `last-assigned:${teamKey}`;
    const result = await redis.eval(
      luaScript,
      [lastAssignedKey],
      [JSON.stringify(activeMemberIds)]
    );

    const [selectedMemberId, nextIndex] = result;
    const nextOwner = activeMembers.find(m => String(m.id) === String(selectedMemberId));

    if (!nextOwner) {
      throw new Error(`Selected member ID ${selectedMemberId} not found in active members`);
    }

    console.log(
      `[${teamKey}] ➜ Assigning to ${nextOwner.name} (${nextOwner.id}) - ATOMIC`
    );

    // ------------------------------
    // HUBSPOT UPDATE (DIRECT API CALL)
    // ------------------------------
    const hubspotResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            hubspot_owner_id: nextOwner.id
          }
        })
      }
    );

    if (!hubspotResponse.ok) {
      const errorText = await hubspotResponse.text();
      throw new Error(`HubSpot API error (${hubspotResponse.status}): ${errorText}`);
    }

    console.log(
      `[${teamKey}] ✓ Contact ${contactId} updated in HubSpot`
    );

    // ------------------------------
    // INCREMENT STATISTICS
    // ------------------------------
    
    // Use Redis pipeline for atomic increments
    const pipeline = redis.pipeline();
    
    pipeline.incr(`total-count:${teamKey}`);
    pipeline.incr(`member-count:${teamKey}:${nextOwner.id}`);
    pipeline.incr('total-count:global');
    
    const results = await pipeline.exec();
    
    const teamTotal = results[0];
    const memberTotal = results[1];
    const globalTotal = results[2];

    console.log(
      `[${teamKey}] ✓ Stats updated | team: ${teamTotal} | member: ${memberTotal} | global: ${globalTotal}`
    );

    // ------------------------------
    // RESPONSE
    // ------------------------------
    return res.status(200).json({
      success: true,
      contactId,
      team: team.name,
      assignedTo: nextOwner.name,
      ownerId: nextOwner.id,
      assignmentIndex: nextIndex,
      activeMembers: activeMembers.length,
      totalMembers: team.members.length,
      stats: {
        memberAssignments: memberTotal,
        teamAssignments: teamTotal,
        globalAssignments: globalTotal
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('✗ Assignment failed:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}