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
    const { team: teamKey, confirm } = req.body;

    // ------------------------------
    // SAFETY CHECK: REQUIRE CONFIRMATION
    // ------------------------------
    if (confirm !== 'RESET_ALL_DATA') {
      return res.status(400).json({
        error: 'Confirmation required',
        message: 'This action will delete ALL statistics. To proceed, include: {"confirm": "RESET_ALL_DATA"}',
        warning: 'This cannot be undone!'
      });
    }

    // ------------------------------
    // VALIDATION
    // ------------------------------
    if (!teamKey) {
      return res.status(400).json({
        error: 'Missing team',
        message: 'Request body must include team identifier',
        example: { team: 'sales-team', confirm: 'RESET_ALL_DATA' }
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

    // ------------------------------
    // COLLECT ALL KEYS TO DELETE
    // ------------------------------
    const keysToDelete = [];

    // 1. Rotation pointer
    keysToDelete.push(`last-assigned:${teamKey}`);

    // 2. Team total
    keysToDelete.push(`total-count:${teamKey}`);

    // 3. All member counts for this team
    for (const member of team.members) {
      keysToDelete.push(`member-count:${teamKey}:${member.id}`);
    }

    console.log(`[${teamKey}] 🔥 HARD RESET - Deleting ${keysToDelete.length} keys`);

    // ------------------------------
    // DELETE ALL KEYS
    // ------------------------------
    let deletedCount = 0;
    for (const key of keysToDelete) {
      const result = await redis.del(key);
      if (result === 1) {
        deletedCount++;
        console.log(`  ✓ Deleted: ${key}`);
      }
    }

    console.log(
      `[${teamKey}] ✓ Hard reset complete - ${deletedCount} keys deleted`
    );

    // ------------------------------
    // RESPONSE
    // ------------------------------
    return res.status(200).json({
      success: true,
      message: `Team '${teamKey}' has been completely reset`,
      team: teamKey,
      deletedKeys: deletedCount,
      details: {
        rotationPointer: 'Deleted',
        teamTotal: 'Deleted',
        memberCounts: `Deleted for ${team.members.length} members`,
        globalTotal: 'Preserved (use /api/reset-global to clear)'
      },
      action: 'All statistics cleared. Next assignment starts fresh.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('✗ Hard reset failed:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}