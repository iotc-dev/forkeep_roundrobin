import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', message: 'Use POST method' });
  }

  try {
    const { team: teamKey } = req.body;

    if (!teamKey) {
      return res.status(400).json({
        error: 'Missing team',
        message: 'Request must include team identifier',
        example: { team: 'sales-under-799' }
      });
    }

    // Reset last assigned
    const lastAssignedKey = `last-assigned:${teamKey}`;
    await kv.del(lastAssignedKey);

    // Reset total count
    const countKey = `total-count:${teamKey}`;
    await kv.del(countKey);

    console.log(`⚠️ Team ${teamKey} reset - rotation will start fresh`);

    return res.status(200).json({
      success: true,
      message: `Team '${teamKey}' rotation has been reset`,
      team: teamKey,
      action: 'Next assignment will start from beginning',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Reset failed:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}