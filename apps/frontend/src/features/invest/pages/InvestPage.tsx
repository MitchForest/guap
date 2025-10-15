import type { InstrumentType } from '@guap/types';

import { createMemo, createSignal, createEffect } from 'solid-js';
import { useAppData } from '~/app/contexts/AppDataContext';
import { useAuth } from '~/app/contexts/AuthContext';
import { organizationIdFor } from '~/features/money-map/api/cache';
import { PageContainer } from '~/shared/components/layout/PageContainer';
import { notifyError, notifySuccess } from '~/shared/services/notifications';
import { InvestHero } from '../components/InvestHero';
import { HoldingsTable } from '../components/HoldingsTable';
import { OrdersTable } from '../components/OrdersTable';
import { WatchlistGrid, type WatchlistFormValues } from '../components/WatchlistGrid';
import { OrderModal } from '../components/OrderModal';
import { createInvestData } from '../state/createInvestData';
import {
  cancelInvestmentOrder,
  removeWatchlistEntry,
  submitInvestmentOrder,
  upsertWatchlistEntry,
} from '../api/client';

const InvestPage = () => {
  const { accounts, activeHousehold } = useAppData();
  const { user } = useAuth();

  const organizationId = createMemo(() => {
    const household = activeHousehold();
    if (!household) return null;
    return organizationIdFor(household._id);
  });

  const profileId = createMemo(() => user()?.profileId ?? null);

  const investAccounts = createMemo(() =>
    accounts().filter((account) => account.kind === 'utma' || account.kind === 'brokerage')
  );

  const investData = createInvestData(organizationId, profileId);

  const summary = createMemo(() => ({
    ...investData.summary(),
    positionsCount: investData.positions().length,
  }));

  const [orderModalOpen, setOrderModalOpen] = createSignal(false);
  const [modalSymbol, setModalSymbol] = createSignal<string | undefined>(undefined);
  const [modalInstrument, setModalInstrument] = createSignal<InstrumentType | undefined>(undefined);
  const [modalAccountId, setModalAccountId] = createSignal<string | undefined>(undefined);

  createEffect(() => {
    if (orderModalOpen()) {
      const accountId = modalAccountId();
      if (!accountId) {
        const fallback = investAccounts()[0]?._id;
        if (fallback) {
          setModalAccountId(fallback);
        }
      }
    }
  });

  const openOrderModal = (symbol?: string, instrumentType?: InstrumentType) => {
    setModalSymbol(symbol);
    setModalInstrument(instrumentType);
    setModalAccountId(investAccounts()[0]?._id);
    setOrderModalOpen(true);
  };

  const refetchAll = async () => {
    await Promise.all([
      investData.refetchPositions(),
      investData.refetchOrders(),
      investData.refetchWatchlist(),
    ]);
  };

  const handleTrade = (symbol: string, instrumentType: InstrumentType) =>
    openOrderModal(symbol, instrumentType);

  const handleOrderSubmitted = async (_order?: unknown) => {
    await refetchAll();
  };

  const handleCancelOrder = async (orderId: string) => {
    const orgId = organizationId();
    if (!orgId) return;
    try {
      await cancelInvestmentOrder({ organizationId: orgId, orderId });
      await refetchAll();
      notifySuccess('Order canceled');
    } catch (error) {
      notifyError('Unable to cancel order', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleAddWatchlist = async (values: WatchlistFormValues) => {
    const orgId = organizationId();
    const profile = profileId();
    if (!orgId || !profile) return;
    await upsertWatchlistEntry({
      organizationId: orgId,
      profileId: profile,
      symbol: values.symbol,
      instrumentType: values.instrumentType,
      notes: values.notes,
    });
    await investData.refetchWatchlist();
    notifySuccess('Symbol added to watchlist');
  };

  const handleRemoveWatchlist = async (symbol: string) => {
    const orgId = organizationId();
    const profile = profileId();
    if (!orgId || !profile) return;
    await removeWatchlistEntry({ organizationId: orgId, profileId: profile, symbol });
    await investData.refetchWatchlist();
  };

  const accountOptions = createMemo(() =>
    investAccounts().map((account) => ({ id: account._id, name: account.name }))
  );

  return (
    <PageContainer>
      {organizationId() ? (
        <>
          <div class="flex flex-col gap-8">
            <InvestHero
              totalCents={summary().totalCents}
              dailyChangeCents={summary().dailyChangeCents}
              changePercent={summary().changePercent}
              positionsCount={summary().positionsCount}
              onCreateOrder={() => openOrderModal()}
            />
            <HoldingsTable
              positions={investData.positions()}
              snapshots={investData.snapshots()}
              onTrade={handleTrade}
            />
            <OrdersTable orders={investData.orders()} onCancel={handleCancelOrder} />
            <WatchlistGrid
              entries={investData.watchlist()}
              onAdd={handleAddWatchlist}
              onRemove={handleRemoveWatchlist}
              onTrade={handleTrade}
            />
          </div>
          <OrderModal
            open={orderModalOpen()}
            organizationId={organizationId()!}
            accountOptions={accountOptions()}
            defaultAccountId={modalAccountId()}
            defaultSymbol={modalSymbol()}
            defaultInstrumentType={modalInstrument()}
            onClose={() => setOrderModalOpen(false)}
            onSubmitted={handleOrderSubmitted}
            submitOrder={async (input) =>
              await submitInvestmentOrder({
                organizationId: input.organizationId,
                accountId: input.accountId,
                symbol: input.symbol,
                instrumentType: input.instrumentType,
                side: input.side,
                quantity: input.quantity,
              })
            }
            evaluateGuardrail={async (input) => await investData.evaluateGuardrail(input)}
          />
        </>
      ) : (
        <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">
          Link a household to begin investing.
        </div>
      )}
    </PageContainer>
  );
};

export default InvestPage;
