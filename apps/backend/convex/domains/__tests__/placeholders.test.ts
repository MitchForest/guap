import { describe, expect, it } from 'vitest';

import * as accounts from '../accounts';
import * as transactions from '../transactions';
import * as transfers from '../transfers';
import * as events from '../events';

describe('domain exports', () => {
  it('exposes accounts entry points', () => {
    expect(typeof (accounts as any).syncAccounts).toBe('function');
    expect(typeof (accounts as any).listForOrganization).toBe('function');
    expect(typeof (accounts as any).getById).toBe('function');
    expect(typeof (accounts as any).listSnapshots).toBe('function');
  });

  it('exposes transactions entry points', () => {
    expect(typeof (transactions as any).listForOrganization).toBe('function');
    expect(typeof (transactions as any).listCategoryRules).toBe('function');
    expect(typeof (transactions as any).upsertCategoryRule).toBe('function');
  });

  it('exposes transfers entry points', () => {
    expect(typeof (transfers as any).listForOrganization).toBe('function');
    expect(typeof (transfers as any).updateStatus).toBe('function');
  });

  it('exposes events entry points', () => {
    expect(typeof (events as any).listForOrganization).toBe('function');
    expect(typeof (events as any).markEventRead).toBe('function');
  });
});
