import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

crons.hourly(
  'earn:process-schedules',
  { minuteUTC: 5 },
  internal.domains.earn.mutations.processEarnSchedules
);

export default crons;
