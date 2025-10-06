import { ConvexClient } from 'convex/browser';

const convexUrl = import.meta.env.VITE_CONVEX_URL || 'http://localhost:3000';

export const convex = new ConvexClient(convexUrl);
