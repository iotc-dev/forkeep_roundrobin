import { redis } from '../lib/redis.js';


// ==============================
// TEAM CONFIGURATION
// (must match assign.js)
// ==============================
const TEAMS = {
  '400': {
    name: '900',
    members: [
      { id: '77614604', name: 'Josiah Dalisay (Main)', active: true },
      { id: '75746033', name: 'Josiah Dalisay (Alt)', active: true },
      { id: '361909438', name: 'Sales1', active: true },
      { id: '361908743', name: 'Dev Account', active: true }
    ]
  },
  '900': {
    name: '900',
    members: [
      { id: '77614604', name: 'Josiah Dalisay (Main)', active: true },
      { id: '75746033', name: 'Josiah Dalisay (Alt)', active: true },
      { id: '361909438', name: 'Sales1', active: true },
      { id: '361908743', name: 'Dev Account', active: true }
    ]
  }
};

export default async function handler(req, res) {
  // Enforce GET
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Use GET'
    });
  }

  try {
    const teamsData = {};

    // ==============================
    // PROCESS EACH TEAM
    // ==============================
    for (const [teamKey, teamConfig] of Object.entries(TEAMS)) {
      const activeMembers = teamConfig.members.filter(m => m.active === true);

      // Redis keys
      const lastAssignedKey = `last-assigned:${teamKey}`;
      const countKey = `total-count:${teamKey}`;

      // Fetch Redis state
      const lastAssignedId = await redis.get(lastAssignedKey);
      const totalAssignments = Number(await redis.get(countKey)) || 0;

      // Determine last assigned member
      let lastAssignedMember = null;
      if (lastAssignedId) {
        lastAssignedMember = activeMembers.find(
          m => String(m.id) === String(lastAssignedId)
        ) || null;
      }

      // Determine next owner
      let nextOwner = null;
      let nextOwnerId = null;

      if (activeMembers.length > 0) {
        if (lastAssignedMember) {
          const lastPosition = activeMembers.findIndex(
            m => String(m.id) === String(lastAssignedId)
          );
          const nextIndex = (lastPosition + 1) % activeMembers.length;
          nextOwner = activeMembers[nextIndex].name;
          nextOwnerId = activeMembers[nextIndex].id;
        } else {
          // Either no assignments yet or last assigned is inactive
          nextOwner = activeMembers[0].name;
          nextOwnerId = activeMembers[0].id;
        }
      }

      // Build response object
      teamsData[teamKey] = {
        name: teamConfig.name,
        members: teamConfig.members,
        activeMembers: activeMembers.length,
        totalMembers: teamConfig.members.length,
        lastAssigned: lastAssignedMember?.name || null,
        lastAssignedId: lastAssignedId || null,
        nextOwner,
        nextOwnerId,
        totalAssignments
      };
    }

    // ==============================
    // RESPONSE
    // ==============================
    return res.status(200).json({
      teams: teamsData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Teams endpoint failed:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
