import { redis } from '../lib/redis.js';
import { TEAMS } from '../lib/teams-config.js';


// ==============================
// ASSIGNMENT HANDLER
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
    // ACTIVE MEMBERS
    // ------------------------------
    const activeMembers = team.members.filter(m => m.active === true);

    console.log(
      `[${teamKey}] ${team.members.length} total | ${activeMembers.length} active`
    );

    if (activeMembers.length === 0) {
      return res.status(400).json({
        error: 'No active members',
        message: `Team '${teamKey}' has no active members`,
        hint: 'Set at least one member to active: true'
      });
    }

    // ------------------------------
    // REDIS: GET LAST ASSIGNED
    // ------------------------------
    const lastAssignedKey = `last-assigned:${teamKey}`;
    const lastAssignedId = await redis.get(lastAssignedKey);

    console.log(`[${teamKey}] Last assigned: ${lastAssignedId || 'none'}`);

    // ------------------------------
    // ROUND-ROBIN CALCULATION
    // ------------------------------
    let nextIndex = 0;

    if (lastAssignedId) {
      const lastPosition = activeMembers.findIndex(
        m => String(m.id) === String(lastAssignedId)
      );

      if (lastPosition !== -1) {
        nextIndex = (lastPosition + 1) % activeMembers.length;
        console.log(
          `[${teamKey}] Last position ${lastPosition} → Next ${nextIndex}`
        );
      } else {
        console.log(
          `[${teamKey}] Last assigned not active anymore → restarting`
        );
        nextIndex = 0;
      }
    }

    const nextOwner = activeMembers[nextIndex];

    console.log(
      `[${teamKey}] ➜ Assigning to ${nextOwner.name} (${nextOwner.id})`
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
    // REDIS: SAVE STATE & TRACK METRICS
    // ------------------------------
    
    // 1. Save who was assigned (for round-robin)
    await redis.set(lastAssignedKey, nextOwner.id);

    // 2. Increment team total
    const countKey = `total-count:${teamKey}`;
    const totalAssignments = await redis.incr(countKey);

    // 3. Increment member count
    const memberCountKey = `member-count:${teamKey}:${nextOwner.id}`;
    const memberAssignments = await redis.incr(memberCountKey);

    // 4. Increment global total
    const globalTotal = await redis.incr('total-count:global');

    console.log(
      `[${teamKey}] ✓ Redis updated | team: ${totalAssignments} | member: ${memberAssignments} | global: ${globalTotal}`
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
        memberAssignments,
        teamAssignments: totalAssignments,
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