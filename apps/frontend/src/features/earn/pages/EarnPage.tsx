import { createMemo, createSignal, type Component } from 'solid-js';
import { useAppData } from '~/app/contexts/AppDataContext';
import { useAuth } from '~/app/contexts/AuthContext';
import { organizationIdFor } from '~/features/money-map/api/cache';
import type { IncomeStreamRecord } from '@guap/api';
import { notifyError, notifyInfo, notifySuccess } from '~/shared/services/notifications';
import { reportError } from '~/shared/services/errors';
import { EarnHero } from '../components/EarnHero';
import { IncomeStreamList } from '../components/IncomeStreamList';
import { StreamFormModal, type StreamFormValues } from '../components/StreamFormModal';
import { EarnTimeline } from '../components/EarnTimeline';
import { EarnProjectionCard } from '../components/EarnProjectionCard';
import { createEarnData } from '../state/createEarnData';
import { formatCurrency } from '~/shared/utils/format';

const centsFromDollars = (value: number) => Math.round(value * 100);

const EarnPage: Component = () => {
  const { accounts, activeHousehold } = useAppData();
  const { user } = useAuth();

  const householdId = createMemo(() => activeHousehold()?._id ?? null);
  const organizationId = createMemo(() => {
    const id = householdId();
    return id ? organizationIdFor(id) : null;
  });

  const earnData = createEarnData(organizationId);

  const [formOpen, setFormOpen] = createSignal(false);
  const [formMode, setFormMode] = createSignal<'create' | 'edit'>('create');
  const [editingStream, setEditingStream] = createSignal<IncomeStreamRecord | null>(null);

  const handleCreateStream = () => {
    setFormMode('create');
    setEditingStream(null);
    setFormOpen(true);
  };

  const handleEditStream = (stream: IncomeStreamRecord) => {
    setFormMode('edit');
    setEditingStream(stream);
    setFormOpen(true);
  };

  const handleSubmitStream = async (values: StreamFormValues) => {
    const orgId = organizationId();
    const profileId = user()?.profileId;
    if (!orgId || !profileId) {
      notifyError('Missing information', {
        description: 'You need an active household to manage income streams.',
      });
      return;
    }

    const destinationAccountId = values.defaultDestinationAccountId && values.defaultDestinationAccountId.length
      ? values.defaultDestinationAccountId
      : null;
    const sourceAccountId = values.sourceAccountId && values.sourceAccountId.length
      ? values.sourceAccountId
      : null;

    const payload = {
      organizationId: orgId,
      ownerProfileId: editingStream()?.ownerProfileId ?? profileId,
      name: values.name.trim(),
      cadence: values.cadence,
      amount: {
        cents: centsFromDollars(values.amount),
        currency: 'USD',
      },
      autoSchedule: values.autoSchedule,
      requiresApproval: values.requiresApproval,
      defaultDestinationAccountId: destinationAccountId,
      sourceAccountId,
    } as const;

    try {
      if (formMode() === 'create' || !editingStream()) {
        await earnData.createStream({
          ...payload,
        });
        notifySuccess('Income stream created', {
          description: `${payload.name} will ${payload.autoSchedule ? 'auto-run' : 'await approval'}.`,
        });
      } else {
        await earnData.updateStream({
          organizationId: orgId,
          incomeStreamId: editingStream()!._id,
          name: payload.name,
          cadence: payload.cadence,
          amount: payload.amount,
          autoSchedule: payload.autoSchedule,
          requiresApproval: payload.requiresApproval,
          defaultDestinationAccountId: payload.defaultDestinationAccountId ?? undefined,
          sourceAccountId: payload.sourceAccountId ?? undefined,
        });
        notifySuccess('Income stream updated', {
          description: `${payload.name} saved.`,
        });
      }
    } catch (error) {
      reportError(error, 'saveIncomeStream');
      notifyError('Unable to save stream', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  };

  const handleRequestPayout = async (stream: IncomeStreamRecord, force = false) => {
    const orgId = organizationId();
    if (!orgId) return;
    try {
      const result = await earnData.requestPayout({
        organizationId: orgId,
        incomeStreamId: stream._id,
        force,
      });
      if (!result) return;
      if (result.status === 'executed') {
        notifySuccess('Payout executed', {
          description: `${stream.name} sent ${formatCurrency(stream.amount.cents)} automatically.`,
        });
      } else {
        notifyInfo('Payout pending approval', {
          description: `${stream.name} is waiting for a parent review.`,
        });
      }
    } catch (error) {
      reportError(error, 'requestIncomePayout');
      notifyError('Unable to request payout', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleSkipPayout = async (stream: IncomeStreamRecord) => {
    const orgId = organizationId();
    if (!orgId) return;
    try {
      await earnData.skipPayout({
        organizationId: orgId,
        incomeStreamId: stream._id,
      });
      notifyInfo('Payout skipped', {
        description: `${stream.name} pushed to the next cadence.`,
      });
    } catch (error) {
      reportError(error, 'skipIncomePayout');
      notifyError('Unable to skip payout', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleToggleAuto = async (stream: IncomeStreamRecord, nextValue: boolean) => {
    const orgId = organizationId();
    if (!orgId) return;
    try {
      await earnData.updateStream({
        organizationId: orgId,
        incomeStreamId: stream._id,
        autoSchedule: nextValue,
      });
      notifySuccess('Schedule updated', {
        description: `${stream.name} ${nextValue ? 'will auto-run' : 'requires manual requests'}.`,
      });
    } catch (error) {
      reportError(error, 'toggleAutoSchedule');
      notifyError('Unable to update schedule', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleStatusChange = async (
    stream: IncomeStreamRecord,
    status: IncomeStreamRecord['status']
  ) => {
    const orgId = organizationId();
    if (!orgId) return;
    try {
      await earnData.updateStream({
        organizationId: orgId,
        incomeStreamId: stream._id,
        status,
      });
      const descriptor = status === 'active' ? 'resumed' : 'paused';
      const readableStatus = status === 'active' ? 'active' : status === 'paused' ? 'paused' : 'archived';
      notifyInfo(`Stream ${descriptor}`, {
        description: `${stream.name} is now ${readableStatus}.`,
      });
    } catch (error) {
      reportError(error, 'updateIncomeStreamStatus');
      notifyError('Unable to update status', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const summary = createMemo(() => earnData.summary());
  const streams = createMemo(() => earnData.streams());
  const firstActiveStream = createMemo(() => streams().find((stream) => stream.status === 'active') ?? null);

  return (
    <div class="space-y-8">
      <EarnHero
        summary={summary()}
        streamsCount={streams().length}
        loading={earnData.summaryLoading()}
        onCreateStream={handleCreateStream}
        onRequestPayout={() => {
          const stream = firstActiveStream();
          if (stream) {
            void handleRequestPayout(stream);
          }
        }}
      />
      <EarnProjectionCard
        projections={summary()?.projections ?? []}
        loading={earnData.summaryLoading()}
      />
      <IncomeStreamList
        streams={streams()}
        loading={earnData.streamsLoading()}
        onCreate={handleCreateStream}
        onEdit={handleEditStream}
        onRequest={(stream) => void handleRequestPayout(stream)}
        onSkip={(stream) => void handleSkipPayout(stream)}
        onToggleAuto={(stream, value) => void handleToggleAuto(stream, value)}
        onStatusChange={(stream, status) => void handleStatusChange(stream, status)}
      />
      <EarnTimeline
        entries={earnData.timeline()}
        loading={earnData.timelineLoading()}
        streams={streams()}
      />
      <StreamFormModal
        mode={formMode()}
        open={formOpen()}
        stream={editingStream()}
        accounts={accounts()}
        onOpenChange={setFormOpen}
        onSubmit={(values) => handleSubmitStream(values)}
      />
    </div>
  );
};

export default EarnPage;
