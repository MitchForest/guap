import { defineApp } from 'convex/server';
import betterAuth from './core/auth/generated/convex.config';
import crons from './crons';

const app = defineApp();

app.use(betterAuth);
const appAny = app as any;
if (typeof appAny.cron === 'function') {
  appAny.cron(crons);
} else if (appAny.crons && typeof appAny.crons.import === 'function') {
  appAny.crons.import(crons);
}

export default app;
