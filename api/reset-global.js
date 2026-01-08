import { redis } from '../lib/redis.js';
import { TEAMS } from '../lib/teams-config.js';


export default async function handler(req, res) {
  // Enforce POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Use POST'
    });
  }

  try {
    const { confirm } = req.body;

    // Safety check - require confirmation
    if (confirm !== 'RESET_EVERYTHING') {
      return res.status(400).json({
        error: 'Confirmation required',
        message: 'This action will delete ALL statistics for ALL teams. To proceed, include: {"confirm": "RESET_EVERYTHING"}',
        warning: '⚠️ THIS CANNOT BE UNDONE! ⚠️',
        affectedTeams: Object.keys(TEAMS)
      });
    }

    // Collect all keys to delete
    const keysToDelete = [];
    const summary = {
      teams: {},
      totalKeys: 0
    };

    // Process each team
    for (const [teamKey, teamConfig] of Object.entries(TEAMS)) {
      const teamKeys = [];

      // 1. Rotation pointer
      teamKeys.push(`last-assigned:${teamKey}`);

      // 2. Team total
      teamKeys.push(`total-count:${teamKey}`);

      // 3. All member counts
      for (const member of teamConfig.members) {
        teamKeys.push(`member-count:${teamKey}:${member.id}`);
      }

      keysToDelete.push(...teamKeys);
      summary.teams[teamKey] = {
        name: teamConfig.name,
        keysDeleted: teamKeys.length,
        members: teamConfig.members.length
      };
    }

    // 4. Global total
    keysToDelete.push('total-count:global');

    summary.totalKeys = keysToDelete.length;

    console.log(`🔥 GLOBAL RESET - Deleting ${keysToDelete.length} keys across ${Object.keys(TEAMS).length} teams`);

    // Delete all keys
    let deletedCount = 0;
    for (const key of keysToDelete) {
      const result = await redis.del(key);
      if (result === 1) {
        deletedCount++;
        console.log(`  ✓ Deleted: ${key}`);
      }
    }

    console.log(`✓ Global reset complete - ${deletedCount} keys deleted`);

    return res.status(200).json({
      success: true,
      message: 'All teams have been completely reset',
      deletedKeys: deletedCount,
      teamsAffected: Object.keys(TEAMS).length,
      summary: summary.teams,
      details: {
        rotationPointers: 'All deleted',
        teamTotals: 'All deleted',
        memberCounts: 'All deleted',
        globalTotal: 'Deleted'
      },
      action: 'Complete system reset. All statistics cleared.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('✗ Global reset failed:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
