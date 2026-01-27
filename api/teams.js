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


export default async function handler(req, res) {
  // ==============================
  // CORS HEADERS
  // ==============================
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Enforce GET
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Use GET'
    });
  }

  try {
    const teamsData = {};
    let globalTotal = 0;

    // Get global total
    const globalCount = await redis.get('total-count:global');
    globalTotal = Number(globalCount) || 0;

    // ==============================
    // PROCESS EACH TEAM
    // ==============================
    for (const [teamKey, teamConfig] of Object.entries(TEAMS)) {
      
      // Get active status and stats for all members
      const membersWithStats = await Promise.all(
        teamConfig.members.map(async (member) => {
          const isActive = await isActiveMember(teamKey, member);
          const memberCountKey = `member-count:${teamKey}:${member.id}`;
          const memberCount = await redis.get(memberCountKey);
          
          return {
            id: member.id,
            name: member.name,
            active: isActive,
            assignedLeads: Number(memberCount) || 0
          };
        })
      );

      const activeMembers = membersWithStats.filter(m => m.active === true);

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

      // Add percentage to members
      const membersWithPercentage = membersWithStats.map(member => ({
        ...member,
        percentage: totalAssignments > 0 
          ? ((member.assignedLeads) / totalAssignments * 100).toFixed(1)
          : '0.0'
      }));

      // Build response object
      teamsData[teamKey] = {
        name: teamConfig.name,
        members: membersWithPercentage,
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
      globalStats: {
        totalAssignments: globalTotal,
        totalTeams: Object.keys(TEAMS).length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('✗ Teams endpoint failed:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}