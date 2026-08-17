#!/usr/bin/env node
/**
 * Dev helper: starts the Supabase registration helper, then Angular.
 * You only run: npm start
 */
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const root = path.join(__dirname, '..');
const API_PORT = Number(process.env.REGISTER_API_PORT || 3001);

function apiAlreadyUp() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${API_PORT}/api/register`, () => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(400, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  const up = await apiAlreadyUp();
  let apiChild = null;

  if (!up) {
    apiChild = spawn(process.execPath, [path.join(__dirname, 'register-api.cjs')], {
      cwd: root,
      stdio: 'inherit',
      env: process.env
    });
    // brief wait so API is listening before Angular opens
    await new Promise((r) => setTimeout(r, 500));
  } else {
    console.log(`[start] registration helper already on :${API_PORT}`);
  }

  const ng = spawn(
    process.execPath,
    [path.join(root, 'node_modules/@angular/cli/bin/ng'), 'serve'],
    { cwd: root, stdio: 'inherit', env: process.env }
  );

  const shutdown = () => {
    if (apiChild) apiChild.kill('SIGTERM');
    ng.kill('SIGTERM');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  ng.on('exit', (code) => {
    if (apiChild) apiChild.kill('SIGTERM');
    process.exit(code || 0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
