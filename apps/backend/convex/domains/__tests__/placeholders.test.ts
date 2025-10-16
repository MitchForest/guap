import { describe, expect, it } from 'vitest';

import * as accounts from '../accounts';
import * as transactions from '../transactions';
import * as transfers from '../transfers';
import * as events from '../events';
import * as earn from '../earn';
import * as savings from '../savings';
import * as budgets from '../budgets';
import * as liabilities from '../liabilities';

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
    expect(typeof (transactions as any).deleteCategoryRule).toBe('function');
    expect(typeof (transactions as any).reorderCategoryRules).toBe('function');
  });

  it('exposes transfers entry points', () => {
    expect(typeof (transfers as any).listForOrganization).toBe('function');
    expect(typeof (transfers as any).updateStatus).toBe('function');
    expect(typeof (transfers as any).initiateSpendTransfer).toBe('function');
  });

  it('exposes events entry points', () => {
    expect(typeof (events as any).listForOrganization).toBe('function');
    expect(typeof (events as any).markEventRead).toBe('function');
  });

  it('exposes earn entry points', () => {
    expect(typeof (earn as any).listForOrganization).toBe('function');
    expect(typeof (earn as any).summarizeForOrganization).toBe('function');
    expect(typeof (earn as any).createIncomeStream).toBe('function');
    expect(typeof (earn as any).requestIncomePayout).toBe('function');
  });

  it('exposes savings entry points', () => {
    expect(typeof (savings as any).listForOrganization).toBe('function');
    expect(typeof (savings as any).createGoal).toBe('function');
    expect(typeof (savings as any).initiateTransfer).toBe('function');
  });

  it('exposes budgets entry points', () => {
    expect(typeof (budgets as any).listForOrganization).toBe('function');
    expect(typeof (budgets as any).summarizeForOrganization).toBe('function');
    expect(typeof (budgets as any).createBudget).toBe('function');
    expect(typeof (budgets as any).updateBudget).toBe('function');
    expect(typeof (budgets as any).archiveBudget).toBe('function');
    expect(typeof (budgets as any).updateGuardrail).toBe('function');
  });

  it('exposes liability entry points', () => {
    expect(typeof (liabilities as any).listForOrganization).toBe('function');
    expect(typeof (liabilities as any).getByAccount).toBe('function');
    expect(typeof (liabilities as any).upsertTerms).toBe('function');
  });
});
