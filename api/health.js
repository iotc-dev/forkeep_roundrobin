import { Client } from '@hubspot/api-client';
import { redis } from '../lib/redis.js';


export default async function handler(req, res) {
  // Enforce GET
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Use GET'
    });
  }

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {}
  };

  // ==============================
  // REDIS (UPSTASH) CHECK
  // ==============================
  try {
    await redis.set('health-check', Date.now());
    await redis.get('health-check');

    health.checks.redis = {
      status: 'connected',
      message: 'Upstash Redis connection successful'
    };
  } catch (error) {
    health.status = 'degraded';
    health.checks.redis = {
      status: 'failed',
      message: error.message
    };
  }

  // ==============================
  // HUBSPOT API CHECK
  // ==============================
  try {
    if (!process.env.HUBSPOT_ACCESS_TOKEN) {
      throw new Error('HUBSPOT_ACCESS_TOKEN not configured');
    }

    const hubspotClient = new Client({
      accessToken: process.env.HUBSPOT_ACCESS_TOKEN
    });

    // Use the most basic endpoint available on all HubSpot accounts
    // GET /crm/v3/properties/contacts - Lists contact properties
    // This endpoint is universally available and requires minimal permissions
    await hubspotClient.crm.properties.coreApi.getAll('contacts', false);

    health.checks.hubspot = {
      status: 'authenticated',
      message: 'HubSpot API connection successful'
    };
  } catch (error) {
    health.status = 'degraded';
    health.checks.hubspot = {
      status: 'failed',
      message: error.message,
      hint: 'Check HUBSPOT_ACCESS_TOKEN and permissions'
    };
  }

  // ==============================
  // ENVIRONMENT CHECK
  // ==============================
  const requiredEnvVars = [
    'HUBSPOT_ACCESS_TOKEN',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN'
  ];

  const missingEnvVars = requiredEnvVars.filter(
    name => !process.env[name]
  );

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