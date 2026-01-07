import { Client } from '@hubspot/api-client';
import { redis } from '../lib/redis';

// ==============================
// TEAM CONFIGURATION
// ==============================
const TEAMS = {
  'sales-team': {
    name: 'Sales Team',
    members: [
      { id: '77614604', name: 'Josiah Dalisay (Main)', active: true },
      { id: '75746033', name: 'Josiah Dalisay (Alt)', active: true },
      { id: '361908743', name: 'Dev Account', active: true }
    ]
  }
};

// ==============================
// HUBSPOT CLIENT
// ==============================
const hubspotClient = new Client({
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN
});

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
    // HUBSPOT UPDATE
    // ------------------------------
    await hubspotClient.crm.contacts.basicApi.update(contactId, {
      properties: {
        hubspot_owner_id: nextOwner.id
      }
    });

    console.log(
      `[${teamKey}] ✓ Contact ${contactId} updated in HubSpot`
    );

    // ------------------------------
    // REDIS: SAVE STATE
    // ------------------------------
    await redis.set(lastAssignedKey, nextOwner.id);

    const countKey = `total-count:${teamKey}`;
    const totalAssignments = await redis.incr(countKey);

    console.log(
      `[${teamKey}] ✓ Redis updated | total assignments: ${totalAssignments}`
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
      totalAssignments,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Assignment failed:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
