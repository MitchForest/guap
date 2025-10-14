import { describe, expect, it } from 'vitest';
import {
  transferIntentLabel,
  transferStatusLabel,
  transferStatusTone,
  formatSubmittedAt,
} from '../features/app-shell/components/ApprovalsInbox';

describe('ApprovalsInbox helpers', () => {
  it('formats intent labels', () => {
    expect(transferIntentLabel('credit_payoff')).toBe('credit payoff');
  });

  it('formats status labels', () => {
    expect(transferStatusLabel('pending_approval')).toBe('pending approval');
  });

  it('maps status to tone classes', () => {
    expect(transferStatusTone('pending_approval')).toContain('amber');
    expect(transferStatusTone('approved')).toContain('emerald');
    expect(transferStatusTone('executed')).toContain('slate');
  });

  it('formats submission timestamp', () => {
    const timestamp = 1_700_000_000_000;
    expect(formatSubmittedAt(timestamp)).toBe(new Date(timestamp).toLocaleString());
  });
});
