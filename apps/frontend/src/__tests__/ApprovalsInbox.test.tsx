import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@solidjs/testing-library';
import type { TransferRecord, InvestmentOrderRecord } from '@guap/api';
import { ApprovalsInbox,
  transferIntentLabel,
  transferStatusLabel,
  transferStatusTone,
  formatSubmittedAt,
} from '../features/app-shell/components/ApprovalsInbox';
import { guapApi } from '~/shared/services/guapApi';
import * as csvUtils from '~/shared/utils/csv';

const currency = (cents: number) => ({ cents, currency: 'USD' as const });

const asMock = <T extends (...args: any[]) => any>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const baseTransfer = (overrides: Partial<TransferRecord> = {}): TransferRecord => ({
  _id: overrides._id ?? 'transfer-1',
  organizationId: overrides.organizationId ?? 'org-1',
  intent: overrides.intent ?? 'save',
  sourceAccountId: overrides.sourceAccountId ?? 'source-1',
  destinationAccountId: overrides.destinationAccountId ?? 'dest-1',
  amount: overrides.amount ?? currency(10_00),
  requestedByProfileId: overrides.requestedByProfileId ?? 'member-1',
  approvedByProfileId: overrides.approvedByProfileId ?? null,
  status: overrides.status ?? 'pending_approval',
  goalId: overrides.goalId ?? null,
  orderId: overrides.orderId ?? null,
  requestedAt: overrides.requestedAt ?? Date.now(),
  approvedAt: overrides.approvedAt ?? null,
  executedAt: overrides.executedAt ?? null,
  metadata: overrides.metadata ?? {},
  createdAt: overrides.createdAt ?? Date.now(),
  updatedAt: overrides.updatedAt ?? Date.now(),
});

const baseOrder = (overrides: Partial<InvestmentOrderRecord> = {}): InvestmentOrderRecord => ({
  _id: overrides._id ?? 'order-1',
  organizationId: overrides.organizationId ?? 'org-1',
  accountId: overrides.accountId ?? 'acct-1',
  symbol: overrides.symbol ?? 'VTI',
  instrumentType: overrides.instrumentType ?? 'etf',
  side: overrides.side ?? 'buy',
  orderType: 'market',
  quantity: overrides.quantity ?? 1,
  notional: overrides.notional ?? currency(100_00),
  limitPrice: overrides.limitPrice ?? null,
  status: overrides.status ?? 'awaiting_parent',
  placedByProfileId: overrides.placedByProfileId ?? 'member-1',
  approvedByProfileId: overrides.approvedByProfileId ?? null,
  submittedAt: overrides.submittedAt ?? Date.now(),
  approvedAt: overrides.approvedAt ?? null,
  executedAt: overrides.executedAt ?? null,
  executionPrice: overrides.executionPrice ?? null,
  transferId: overrides.transferId ?? null,
  failureReason: overrides.failureReason ?? null,
  metadata: overrides.metadata ?? {},
});

const mockedGuapApi = vi.mocked(guapApi);

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

describe('ApprovalsInbox interactions', () => {
  beforeEach(() => {
    asMock(mockedGuapApi.transfers.updateStatus).mockResolvedValue(
      baseTransfer({ status: 'approved' })
    );
    asMock(mockedGuapApi.investing.approveOrder).mockResolvedValue(
      baseOrder({ status: 'approved' })
    );
    asMock(mockedGuapApi.investing.cancelOrder).mockResolvedValue(
      baseOrder({ status: 'canceled' })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('bulk approves selected transfers and refreshes data', async () => {
    const transfer = baseTransfer({ _id: 'transfer-approve' });
    const refresh = vi.fn();

    render(() => <ApprovalsInbox transfers={[transfer]} orders={[]} onRefresh={refresh} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select approval' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve selected' }));

    await waitFor(() =>
      expect(mockedGuapApi.transfers.updateStatus).toHaveBeenCalledWith({
        transferId: 'transfer-approve',
        status: 'approved',
      })
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('bulk declines selected orders', async () => {
    const order = baseOrder({ _id: 'order-decline' });

    render(() => <ApprovalsInbox transfers={[]} orders={[order]} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select approval' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decline selected' }));

    await waitFor(() =>
      expect(mockedGuapApi.investing.cancelOrder).toHaveBeenCalledWith({
        organizationId: order.organizationId,
        orderId: 'order-decline',
        reason: 'Declined via approvals inbox',
      })
    );
  });

  it('exports approvals to CSV', () => {
    const downloadCsvSpy = vi.spyOn(csvUtils, 'downloadCsv');
    const transfer = baseTransfer({ _id: 'transfer-csv' });

    render(() => <ApprovalsInbox transfers={[transfer]} orders={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(downloadCsvSpy).toHaveBeenCalled();
    downloadCsvSpy.mockRestore();
  });
});
