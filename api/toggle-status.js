import { redis } from '../lib/redis.js';
import { TEAMS } from '../lib/teams-config.js';


export default async function handler(req, res) {
  // ==============================
  // CORS HEADERS
  // ==============================
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ==============================
  // GET - Load all toggle states
  // ==============================
  if (req.method === 'GET') {
    try {
      const states = {};

      for (const [teamKey, teamConfig] of Object.entries(TEAMS)) {
        for (const member of teamConfig.members) {
          const key = `member-active:${teamKey}:${member.id}`;
          const value = await redis.get(key);
          
          // If no value in Redis, use default from config
          if (value !== null) {
            states[`${teamKey}-${member.id}`] = value === true || value === 'true';  // Handle both boolean and string
          } else {
            states[`${teamKey}-${member.id}`] = member.defaultActive;
          }
        }
      }

      return res.status(200).json({
        success: true,
        states,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('✗ Get toggle states failed:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  // ==============================
  // POST - Save a toggle state
  // ==============================
  if (req.method === 'POST') {
    try {
      const { teamKey, memberId, active } = req.body;

      // Validation
      if (!teamKey) {
        return res.status(400).json({
          error: 'Missing teamKey'
        });
      }

      if (!memberId) {
        return res.status(400).json({
          error: 'Missing memberId'
        });
      }

      if (typeof active !== 'boolean') {
        return res.status(400).json({
          error: 'active must be boolean'
        });
      }

      const team = TEAMS[teamKey];
      if (!team) {
        return res.status(404).json({
          error: 'Team not found',
          availableTeams: Object.keys(TEAMS)
        });
      }

      const member = team.members.find(m => String(m.id) === String(memberId));
      if (!member) {
        return res.status(404).json({
          error: 'Member not found in team'
        });
      }

      // Save to Redis
      const key = `member-active:${teamKey}:${memberId}`;
      await redis.set(key, active.toString());

      console.log(`[${teamKey}] ${member.name} (${memberId}) → ${active ? 'ACTIVE' : 'INACTIVE'}`);

      return res.status(200).json({
        success: true,
        teamKey,
        memberId,
        memberName: member.name,
        active,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('✗ Save toggle state failed:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  return res.status(405).json({
    error: 'Method not allowed',
    message: 'Use GET or POST'
  });
}