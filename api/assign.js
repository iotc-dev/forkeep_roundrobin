import { kv } from '@vercel/kv';
import { Client } from '@hubspot/api-client';

// Team Configuration
// Your actual team members from HubSpot
const TEAMS = {
  'sales-team': {
    name: 'Sales Team',
    members: [
      { id: '77614604', name: 'Josiah Dalisay (Main)', active: true },
      { id: '75746033', name: 'Josiah Dalisay (Alt)', active: true },
      { id: '361908743', name: 'Dev Account', active: true }
    ]
  }
  // Add more teams as needed:
  // 'team-name': {
  //   name: 'Display Name',
  //   members: [
  //     { id: 'OWNER_ID', name: 'Person Name', active: true }
  //   ]
  // }
};

// Initialize HubSpot client
const hubspotClient = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', message: 'Use POST method' });
  }

  try {
    const { contactId, team: teamKey } = req.body;

    // Validate request
    if (!contactId) {
      return res.status(400).json({ error: 'Missing contactId', message: 'Request must include contactId' });
    }

    if (!teamKey) {
      return res.status(400).json({ error: 'Missing team', message: 'Request must include team identifier' });
    }

    // Get team configuration
    const team = TEAMS[teamKey];
    if (!team) {
      return res.status(404).json({
        error: 'Team not found',
        message: `Team '${teamKey}' does not exist`,
        availableTeams: Object.keys(TEAMS)
      });
    }

    if (!team.members || team.members.length === 0) {
      return res.status(400).json({
        error: 'No team members',
        message: `Team '${teamKey}' has no members configured`
      });
    }

    // Filter to active members only
    const activeMembers = team.members.filter(member => member.active);
    console.log(`Team ${teamKey}: ${team.members.length} total, ${activeMembers.length} active`);

    if (activeMembers.length === 0) {
      return res.status(400).json({
        error: 'No active members',
        message: `Team '${teamKey}' has no active members`,
        totalMembers: team.members.length,
        inactiveMembers: team.members.map(m => m.name),
        hint: 'Set at least one member to active: true'
      });
    }

    // Get last assigned owner ID from Redis
    const lastAssignedKey = `last-assigned:${teamKey}`;
    const lastAssignedId = await kv.get(lastAssignedKey);
    console.log(`Last assigned: ${lastAssignedId || 'none'}`);

    // Calculate next owner using round-robin algorithm
    let nextIndex = 0;
    if (lastAssignedId) {
      // Find last assigned person in active members array
      const lastPosition = activeMembers.findIndex(member => member.id === lastAssignedId);
      
      if (lastPosition !== -1) {
        // Calculate next position using modulo for wrap-around
        nextIndex = (lastPosition + 1) % activeMembers.length;
        console.log(`Last assigned person found at position ${lastPosition}`);
      } else {
        // Last assigned person no longer active, restart from beginning
        console.log(`Last assigned person (${lastAssignedId}) is no longer active, restarting rotation`);
        nextIndex = 0;
      }
    }

    const nextOwner = activeMembers[nextIndex];
    console.log(`➡️ Next owner: ${nextOwner.name} (position ${nextIndex} of ${activeMembers.length})`);

    // Update contact owner in HubSpot
    try {
      await hubspotClient.crm.contacts.basicApi.update(contactId, {
        properties: {
          hubspot_owner_id: nextOwner.id
        }
      });
      console.log(`✓ Contact ${contactId} updated in HubSpot`);
    } catch (hubspotError) {
      console.error('HubSpot update failed:', hubspotError.message);
      return res.status(500).json({
        error: 'HubSpot update failed',
        message: hubspotError.message,
        hint: 'Check if contactId exists and Owner ID is valid'
      });
    }

    // Save state to Redis
    await kv.set(lastAssignedKey, nextOwner.id);
    console.log(`✓ Redis updated: last-assigned = ${nextOwner.id}`);

    // Increment total assignment counter
    const countKey = `total-count:${teamKey}`;
    const totalAssignments = await kv.incr(countKey);
    console.log(`✓ Total assignments for ${teamKey}: ${totalAssignments}`);

    // Log success
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Assigned contact ${contactId} to ${nextOwner.name} (Team: ${teamKey})`);

    // Return success response
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
      timestamp
    });

  } catch (error) {
    console.error('Assignment failed:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}