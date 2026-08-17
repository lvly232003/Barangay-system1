/**
 * Vercel Serverless — /api/register
 * Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in Vercel Environment Variables.
 */

const { handleRegister } = require('../scripts/register-handler.cjs');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'authorization, x-client-info, apikey, content-type'
  );

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const result = await handleRegister(body);
    res.status(result.status).json(result.payload);
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : 'Registration failed'
    });
  }
};
