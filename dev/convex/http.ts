import { httpRouter } from 'convex/server';
import { authComponent, createAuth } from './auth';

const http = httpRouter();

// Register Better Auth routes with CORS enabled
// This mounts all routes at /api/auth/* and handles CORS for localhost:3001
authComponent.registerRoutes(http, createAuth, {
  cors: true, // CRITICAL: Enable CORS to allow requests from frontend
});

export default http;
