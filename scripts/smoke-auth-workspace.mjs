#!/usr/bin/env node

/**
 * Smoke test: sign in (or sign up) via Better Auth, obtain a Convex access token,
 * ensure a workspace exists, publish a minimal graph, and verify the persisted record.
 *
 * Requires a running backend with Better Auth + Convex and the following env vars:
 *   SMOKE_AUTH_URL            → Better Auth HTTP endpoint (e.g. http://localhost:3000)
 *   SMOKE_CONVEX_URL          → Convex deployment URL (e.g. http://localhost:3000)
 *   SMOKE_EMAIL               → Email used for the smoke user
 *   SMOKE_NAME                → Display name to seed the profile (used on first sign up)
 *   SMOKE_MAGIC_LINK_SECRET   → Shared secret that allows the smoke harness to capture magic link tokens
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const rootDir = path.join(currentDir, '..');

function loadEnvFile(filename) {
  const filePath = path.join(rootDir, filename);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .forEach((line) => {
      const idx = line.indexOf('=');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (!key) return;
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
}

loadEnvFile('.env');
loadEnvFile('.env.local');

let ConvexHttpClient;
try {
  ({ ConvexHttpClient } = await import('convex/browser'));
} catch {
  const fallbackUrl = new URL('../apps/frontend/node_modules/convex/dist/esm/browser/index.js', import.meta.url);
  ({ ConvexHttpClient } = await import(fallbackUrl.href));
}

if (!ConvexHttpClient) {
  throw new Error('Unable to load ConvexHttpClient from convex/browser');
}

const requiredEnv = [
  'SMOKE_AUTH_URL',
  'SMOKE_CONVEX_URL',
  'SMOKE_EMAIL',
  'SMOKE_NAME',
  'SMOKE_MAGIC_LINK_SECRET',
];

const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const authBase = process.env.SMOKE_AUTH_URL.replace(/\/$/, '');
const convexBase = process.env.SMOKE_CONVEX_URL.replace(/\/$/, '');
const email = process.env.SMOKE_EMAIL;
const displayName = process.env.SMOKE_NAME;
const smokeMagicLinkSecret = process.env.SMOKE_MAGIC_LINK_SECRET;
const cookieJar = new Map();

function setCookie(header) {
  if (!header) return;
  const parts = header.split(/,\s*(?=[^;]+=[^;]+;)/g); // handle multiple cookies in one header
  parts.forEach((part) => {
    const [cookiePart] = part.split(';');
    const [name, ...rest] = cookiePart.trim().split('=');
    if (!name) return;
    cookieJar.set(name, rest.join('='));
  });
}

function getCookieHeader() {
  if (cookieJar.size === 0) return '';
  return Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function getCookieValue(name) {
  const raw = cookieJar.get(name);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function authFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const cookies = getCookieHeader();
  if (cookies) headers.set('cookie', cookies);
  if (!headers.has('origin')) {
    headers.set('origin', authBase);
  }
  if (!headers.has('referer')) {
    headers.set('referer', authBase);
  }
  if (options.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const url = path.startsWith('http://') || path.startsWith('https://') ? path : `${authBase}${path}`;
  const res = await fetch(url, {
    ...options,
    headers,
  });

  const setCookieHeader = res.headers.get('set-cookie');
  if (setCookieHeader) {
    setCookie(setCookieHeader);
  }

  return res;
}

async function requestMagicLink({ key }) {
  const response = await authFetch('/api/auth/sign-in/magic-link', {
    method: 'POST',
    headers: {
      'x-smoke-magic-link-key': key,
      'x-smoke-magic-link-secret': smokeMagicLinkSecret,
    },
    body: JSON.stringify({
      email,
      name: displayName,
      callbackURL: '/',
      newUserCallbackURL: '/',
      errorCallbackURL: '/auth/sign-in',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Magic link request failed: ${response.status} ${text}`);
  }
}

async function fetchMagicLinkToken(key) {
  const response = await authFetch('/api/smoke/magic-link-token', {
    method: 'POST',
    body: JSON.stringify({
      key,
      secret: smokeMagicLinkSecret,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Magic link token fetch failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  if (!data?.token) {
    throw new Error('Magic link token missing in response');
  }

  return data.token;
}

async function verifyMagicLink(token) {
  const params = new URLSearchParams({
    token,
    callbackURL: '/',
  });

  const response = await authFetch(`/api/auth/magic-link/verify?${params.toString()}`, {
    method: 'GET',
    redirect: 'follow',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Magic link verification failed: ${response.status} ${text}`);
  }
}

async function ensureSignedIn() {
  const key = randomUUID();
  await requestMagicLink({ key });
  const token = await fetchMagicLinkToken(key);
  await verifyMagicLink(token);
  return { email };
}

async function fetchConvexToken() {
  const res = await authFetch('/api/auth/convex/token');
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Unable to fetch Convex token: ${res.status} ${text}`);
  }
  const data = await res.json();
  if (!data?.data?.token) {
    throw new Error('Convex token missing in response');
  }
  return data.data.token;
}

function createWorkspacePayload(slug) {
  const now = Date.now();
  return {
    slug,
    nodes: [
      {
        clientId: 'income-smoke',
        type: 'income',
        label: `Smoke Income ${now}`,
        position: { x: 0, y: 0 },
      },
      {
        clientId: 'account-smoke',
        type: 'account',
        label: `Smoke Account ${now}`,
        position: { x: 240, y: 0 },
      },
    ],
    edges: [
      {
        clientId: 'edge-smoke',
        sourceClientId: 'income-smoke',
        targetClientId: 'account-smoke',
        kind: 'manual',
      },
    ],
    rules: [],
  };
}

async function main() {
  console.log('🔐 Signing in (or creating) smoke user…');
  const { email: signedInEmail } = await ensureSignedIn();
  console.log(`✅ Authenticated as ${signedInEmail}`);

  let token = getCookieValue('__Secure-better-auth.convex_jwt');
  if (!token) {
    console.log('🔑 Convex JWT cookie missing, fetching token endpoint…');
    token = await fetchConvexToken();
  } else {
    console.log('🔑 Using Convex JWT from cookie…');
  }

  const slug = `smoke-${Date.now()}`;
  const client = new ConvexHttpClient(convexBase);
  client.setAuth(token);

  console.log(`🛠️  Ensuring workspace '${slug}'…`);
  await client.mutation('workspaces:ensure', { slug, name: `Smoke Workspace ${slug}` });

  console.log('🧭 Publishing minimal graph…');
  const publishPayload = createWorkspacePayload(slug);
  await client.mutation('graph:publish', publishPayload);

  console.log('🔎 Verifying workspace persisted…');
  const workspace = await client.query('workspaces:getBySlug', { slug });
  if (!workspace) {
    throw new Error('Workspace not found after publish');
  }

  console.log(`🎉 Smoke test complete. Workspace ${workspace._id} (${workspace.slug}) verified.`);
}

main().catch((error) => {
  console.error('❌ Smoke test failed');
  console.error(error);
  process.exit(1);
});
