import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import { DonationGuardrailCard } from '../features/donate/components/DonationGuardrailCard';
import type { DonationGuardrailSummary } from '@guap/api';

describe('DonationGuardrailCard', () => {
  const summary = (overrides: Partial<DonationGuardrailSummary> = {}): DonationGuardrailSummary => ({
    approvalPolicy: 'parent_required',
    autoApproveUpToCents: null,
    scope: null,
    ...overrides,
  });

  it('invokes onSave with parsed cents when auto approval enabled', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(() => (
      <DonationGuardrailCard guardrail={summary()} onSave={onSave} />
    ));

    fireEvent.click(screen.getByText('Auto approve'));
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.input(input, { target: { value: '25.50' } });

    fireEvent.click(screen.getByText('Save guardrail'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('auto', 2550);
    });
  });

  it('disables limit input when parent approval selected', () => {
    const onSave = vi.fn();
    render(() => (
      <DonationGuardrailCard guardrail={summary({ approvalPolicy: 'parent_required' })} onSave={onSave} />
    ));

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input).toBeDisabled();
  });
});
