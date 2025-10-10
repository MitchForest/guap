#!/usr/bin/env node
import { execSync } from 'node:child_process';

let ProviderQueue;
let diffProviderSync;

try {
  ({ ProviderQueue, diffProviderSync } = await import('../packages/providers/dist/index.js'));
} catch (error) {
  console.warn('[smoke:provider] Building @guap/providers (dist missing)...');
  execSync('pnpm --filter @guap/providers build', { stdio: 'inherit' });
  ({ ProviderQueue, diffProviderSync } = await import('../packages/providers/dist/index.js'));
}

const log = (message, payload) => {
  process.stdout.write(`${message} ${JSON.stringify(payload)}\n`);
};

async function main() {
  const telemetryEvents = [];
  const queue = new ProviderQueue({
    providerId: 'virtual',
    telemetry: {
      onTaskQueued: (event) => telemetryEvents.push({ type: 'queued', event }),
      onTaskStarted: (event) => telemetryEvents.push({ type: 'started', event }),
      onTaskSucceeded: (event) => telemetryEvents.push({ type: 'succeeded', event }),
      onTaskFailed: (event) => telemetryEvents.push({ type: 'failed', event }),
      onTaskSettled: (event) => telemetryEvents.push({ type: `settled:${event.status}`, event }),
      onTaskRejected: (event) => telemetryEvents.push({ type: 'rejected', event }),
    },
  });

  const result = await queue.enqueue(async () => 42);
  if (result !== 42) {
    throw new Error('Unexpected queue result payload');
  }

  const diff = diffProviderSync(
    {
      accounts: [],
      transactions: [],
      incomeStreams: [],
      users: [],
    },
    {
      accounts: [
        {
          providerAccountId: 'acct-1',
          name: 'Demo',
          kind: 'checking',
          status: 'active',
          currency: 'USD',
          balance: { cents: 1000, currency: 'USD' },
        },
      ],
      transactions: [],
      incomeStreams: [],
      users: [],
    }
  );

  log('telemetry', telemetryEvents.map((item) => item.type));
  log('diff.summary', {
    accounts: {
      created: diff.accounts.created.length,
      updated: diff.accounts.updated.length,
      removed: diff.accounts.removed.length,
    },
  });

  // Ensure critical telemetry hooks fired.
  const phases = new Set(telemetryEvents.map((item) => item.type));
  for (const expected of ['queued', 'started', 'succeeded', 'settled:success']) {
    if (!phases.has(expected)) {
      throw new Error(`Missing telemetry phase: ${expected}`);
    }
  }

  log('status', { success: true });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
