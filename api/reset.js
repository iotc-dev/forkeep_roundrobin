import { redis } from '../lib/redis.js';


export default async function handler(req, res) {
  // Enforce POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Use POST'
    });
  }

  try {
    const { team: teamKey } = req.body;

    // ------------------------------
    // VALIDATION
    // ------------------------------
    if (!teamKey) {
      return res.status(400).json({
        error: 'Missing team',
        message: 'Request body must include team identifier',
        example: { team: 'sales-team' }
      });
    }

    // ------------------------------
    // REDIS RESET
    // ------------------------------
    const lastAssignedKey = `last-assigned:${teamKey}`;
    const countKey = `total-count:${teamKey}`;

    await redis.del(lastAssignedKey);
    await redis.del(countKey);

    console.log(
      `⚠️ [${teamKey}] Rotation reset – next assignment starts from beginning`
    );

    // ------------------------------
    // RESPONSE
    // ------------------------------
    return res.status(200).json({
      success: true,
      message: `Team '${teamKey}' rotation has been reset`,
      team: teamKey,
      action: 'Next assignment will start from beginning',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Reset failed:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
