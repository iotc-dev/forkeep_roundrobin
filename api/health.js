import { kv } from '@vercel/kv';
import { Client } from '@hubspot/api-client';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', message: 'Use GET method' });
  }

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {}
  };

  // Check Redis/Vercel KV connection
  try {
    await kv.set('health-check', Date.now());
    const value = await kv.get('health-check');
    health.checks.redis = {
      status: 'connected',
      message: 'Redis connection successful'
    };
  } catch (error) {
    health.status = 'degraded';
    health.checks.redis = {
      status: 'failed',
      message: error.message
    };
  }

  // Check HubSpot API credentials
  try {
    if (!process.env.HUBSPOT_ACCESS_TOKEN) {
      throw new Error('HUBSPOT_ACCESS_TOKEN not configured');
    }

    const hubspotClient = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });
    
    // Make a simple API call to verify authentication
    await hubspotClient.crm.owners.getAll();
    
    health.checks.hubspot = {
      status: 'authenticated',
      message: 'HubSpot API connection successful'
    };
  } catch (error) {
    health.status = 'degraded';
    health.checks.hubspot = {
      status: 'failed',
      message: error.message,
      hint: 'Check HUBSPOT_ACCESS_TOKEN environment variable'
    };
  }

  // Check environment variables
  const requiredEnvVars = ['HUBSPOT_ACCESS_TOKEN'];
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingEnvVars.length > 0) {
    health.status = 'degraded';
    health.checks.environment = {
      status: 'incomplete',
      message: 'Missing required environment variables',
      missing: missingEnvVars
    };
  } else {
    health.checks.environment = {
      status: 'configured',
      message: 'All required environment variables present'
    };
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  return res.status(statusCode).json(health);
}