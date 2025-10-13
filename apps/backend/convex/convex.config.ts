import { defineApp } from 'convex/server';
import betterAuth from './core/auth/generated/convex.config';

const app = defineApp();
app.use(betterAuth);

export default app;
