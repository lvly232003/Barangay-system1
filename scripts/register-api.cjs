/**
 * Local registration API — no Supabase Edge Function deploy needed.
 * Run: npm run register-api
 * Listens on http://localhost:3001/api/register
 *
 * Requires in .env:
 *   SUPABASE_URL=
 *   SUPABASE_SERVICE_ROLE_KEY=   (Dashboard → Settings → API → service_role)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleRegister } = require('./register-handler.cjs');

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i <= 0) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile();

const PORT = Number(process.env.REGISTER_API_PORT || 3001);

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'authorization, x-client-info, apikey, content-type'
  );

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  if (req.method !== 'POST' || url.pathname !== '/api/register') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8') || '{}';
    const body = JSON.parse(raw);
    const result = await handleRegister(body);
    res.writeHead(result.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result.payload));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: e instanceof Error ? e.message : 'Registration failed'
      })
    );
  }
});

server.listen(PORT, () => {
  const hasKey = !!(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  );
  console.log(`[register-api] http://localhost:${PORT}/api/register`);
  if (!hasKey) {
    console.warn(
      '[register-api] Missing SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY in .env'
    );
  } else {
    console.log('[register-api] secret key loaded from .env');
  }
});
