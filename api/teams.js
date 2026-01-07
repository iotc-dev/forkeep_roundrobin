import { kv } from '@vercel/kv';

// Import the same team configuration
const TEAMS = {
  'sales-under-799': {
    name: 'Sales - Under $799',
    members: [
      { id: '246802831', name: 'Sarah', active: true },
      { id: '246802832', name: 'Mike', active: true },
      { id: '246802833', name: 'Jessica', active: true },
      { id: '246802844', name: 'Tom', active: true }
    ]
  },
  'sales-mid-range': {
    name: 'Sales - $800-$1499',
    members: [
      { id: '246802834', name: 'David', active: true },
      { id: '246802835', name: 'Emily', active: true }
    ]
  }
};

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', message: 'Use GET method' });
  }

  try {
    const teamsData = {};

    // Process each team
    for (const [teamKey, teamConfig] of Object.entries(TEAMS)) {
      const activeMembers = teamConfig.members.filter(m => m.active);
      
      // Get last assigned from Redis
      const lastAssignedKey = `last-assigned:${teamKey}`;
      const lastAssignedId = await kv.get(lastAssignedKey);
      
      // Get total assignments count
      const countKey = `total-count:${teamKey}`;
      const totalAssignments = await kv.get(countKey) || 0;

      // Find last assigned member
      let lastAssignedMember = null;
      let nextOwner = null;
      let nextOwnerId = null;

      if (lastAssignedId) {
        lastAssignedMember = activeMembers.find(m => m.id === lastAssignedId);
        
        if (lastAssignedMember) {
          const lastPosition = activeMembers.findIndex(m => m.id === lastAssignedId);
          const nextIndex = (lastPosition + 1) % activeMembers.length;
          const nextMember = activeMembers[nextIndex];
          nextOwner = nextMember.name;
          nextOwnerId = nextMember.id;
        } else if (activeMembers.length > 0) {
          // Last assigned person is no longer active, will start from beginning
          nextOwner = activeMembers[0].name;
          nextOwnerId = activeMembers[0].id;
        }
      } else if (activeMembers.length > 0) {
        // No assignments yet, will start with first active member
        nextOwner = activeMembers[0].name;
        nextOwnerId = activeMembers[0].id;
      }

      teamsData[teamKey] = {
        name: teamConfig.name,
        members: teamConfig.members,
        activeMembers: activeMembers.length,
        totalMembers: teamConfig.members.length,
        lastAssigned: lastAssignedMember?.name || null,
        lastAssignedId: lastAssignedId || null,
        nextOwner,
        nextOwnerId,
        totalAssignments: Number(totalAssignments)
      };
    }

    return res.status(200).json({
      teams: teamsData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Teams endpoint error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}