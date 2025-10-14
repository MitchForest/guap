import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as accounts from '../accounts';
import * as transactions from '../transactions';
import * as budgets from '../budgets';
import * as earn from '../earn';
import * as savings from '../savings';
import * as investing from '../investing';
import * as donate from '../donate';
import * as events from '../events';

const domains = {
  accounts,
  transactions,
  budgets,
  earn,
  savings,
  investing,
  donate,
  events,
} as const;

for (const [domain, module] of Object.entries(domains)) {
  test(`placeholder exports exist for ${domain}`, () => {
    assert.ok(
      typeof (module as Record<string, unknown>).status === 'function',
      `${domain} should export a status query`
    );
    assert.ok(
      typeof (module as Record<string, unknown>).bootstrap === 'function',
      `${domain} should export a bootstrap mutation`
    );
  });
}
