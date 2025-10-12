import { httpRouter } from 'convex/server';
import { authComponent, createAuth } from './auth';
import { consumeSmokeMagicLinkToken } from './magicLinkEmail';
import { httpAction } from './_generated/server';

const http = httpRouter();

const smokeMagicLinkSecret = process.env.SMOKE_MAGIC_LINK_SECRET ?? null;

const smokeMagicLinkToken = httpAction(async (_ctx, request) => {
  if (!smokeMagicLinkSecret) {
    return new Response('Not configured', { status: 404 });
  }

  let secret: unknown;
  try {
    const payload = await request.json();
    secret = payload?.secret;
  } catch {
    return new Response('Invalid payload', { status: 400 });
  }

  if (typeof secret !== 'string') {
    return new Response('Invalid payload', { status: 400 });
  }

  if (secret !== smokeMagicLinkSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const record = consumeSmokeMagicLinkToken();
  if (!record) {
    return new Response('Not found', { status: 404 });
  }

  return Response.json({
    token: record.token,
    url: record.url,
    email: record.email,
  });
});

http.route({
  path: '/api/smoke/magic-link-token',
  method: 'POST',
  handler: smokeMagicLinkToken,
});

// Register Better Auth routes with CORS enabled
// This mounts all routes at /api/auth/* and handles CORS for localhost:3001
authComponent.registerRoutes(http, createAuth, {
  cors: true, // CRITICAL: Enable CORS to allow requests from frontend
});

export default http;
