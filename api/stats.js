import { redis } from '../lib/redis.js';
import { TEAMS } from '../lib/teams-config.js';


export default async function handler(req, res) {
  // Enforce GET
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Use GET'
    });
  }

  try {
    // ==============================
    // GLOBAL STATISTICS
    // ==============================
    const globalCount = await redis.get('total-count:global');
    const globalTotal = Number(globalCount) || 0;

    // ==============================
    // PER-TEAM BREAKDOWN
    // ==============================
    const teamBreakdown = {};
    
    for (const [teamKey, teamConfig] of Object.entries(TEAMS)) {
      const countKey = `total-count:${teamKey}`;
      const teamCount = await redis.get(countKey);
      const teamTotal = Number(teamCount) || 0;

      teamBreakdown[teamKey] = {
        name: teamConfig.name,
        totalAssignments: teamTotal,
        percentage: globalTotal > 0 
          ? ((teamTotal / globalTotal) * 100).toFixed(1)
          : '0.0'
      };
    }

    // ==============================
    // TOP PERFORMERS (ACROSS ALL TEAMS)
    // ==============================
    const allMembers = [];
    
    for (const [teamKey, teamConfig] of Object.entries(TEAMS)) {
      for (const member of teamConfig.members) {
        const memberCountKey = `member-count:${teamKey}:${member.id}`;
        const memberCount = await redis.get(memberCountKey);
        const count = Number(memberCount) || 0;
        
        if (count > 0) {
          allMembers.push({
            name: member.name,
            id: member.id,
            team: teamConfig.name,
            teamKey: teamKey,
            assignedLeads: count,
            active: member.active
          });
        }
      }
    }

    // Sort by assigned leads (descending)
    allMembers.sort((a, b) => b.assignedLeads - a.assignedLeads);

    // ==============================
    // RESPONSE
    // ==============================
    return res.status(200).json({
      global: {
        totalAssignments: globalTotal,
        totalTeams: Object.keys(TEAMS).length,
        totalMembers: Object.values(TEAMS).reduce(
          (sum, team) => sum + team.members.length, 0
        ),
        activeMembers: Object.values(TEAMS).reduce(
          (sum, team) => sum + team.members.filter(m => m.active).length, 0
        )
      },
      teamBreakdown,
      topPerformers: allMembers.slice(0, 10), // Top 10
      allMembers,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('✗ Stats endpoint failed:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}