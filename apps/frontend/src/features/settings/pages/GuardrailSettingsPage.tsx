import { For, Show, createMemo, createSignal, type Component } from 'solid-js';
import { useRouter } from '@tanstack/solid-router';
import { createColumnHelper } from '@tanstack/solid-table';
import type { GuardrailOverview } from '@guap/api';
import { useAppData } from '~/app/contexts/AppDataContext';
import { DataState } from '~/shared/components/data/DataState';
import { Button } from '~/shared/components/ui/button';
import { DataTable } from '~/shared/components/data-table';
import { createGuapQuery } from '~/shared/services/queryHelpers';
import { guapApi } from '~/shared/services/guapApi';
import { organizationIdFor } from '~/features/money-map/api/cache';
import { AppPaths } from '~/app/routerPaths';
import { formatCurrency } from '~/shared/utils/format';

type GuardrailRow = {
  id: string;
  intent: string;
  intentLabel: string;
  scopeLabel: string;
  approvalPolicy: string;
  autoLimit: string;
  extra: string | null;
  updatedAt: number;
  managePath: string | null;
};

const formatIntent = (intent: string) => intent.replace(/_/g, ' ');

const policyLabel = (policy: string, autoLimitCents: number | null) => {
  switch (policy) {
    case 'auto':
      return autoLimitCents != null
        ? `Auto up to ${formatCurrency(autoLimitCents)}`
        : 'Auto approve';
    case 'admin_only':
      return 'Admin approval required';
    default:
      return 'Parent approval required';
  }
};

const routeForIntent = (intent: string): string | null => {
  switch (intent) {
    case 'save':
      return AppPaths.appSave;
    case 'earn':
      return AppPaths.appEarn;
    case 'donate':
      return AppPaths.appDonate;
    case 'spend':
    case 'credit_payoff':
    case 'manual':
      return AppPaths.appSpend;
    case 'invest':
      return AppPaths.appInvest;
    default:
      return null;
  }
};

const columnHelper = createColumnHelper<GuardrailRow>();

const GuardrailSettingsPage: Component = () => {
  const { activeHousehold } = useAppData();
  const router = useRouter();
  const organizationId = createMemo(() => {
    const household = activeHousehold();
    if (!household) return null;
    return organizationIdFor(household._id);
  });

  const guardrailsQuery = createGuapQuery({
    source: () => organizationId() ?? null,
    initialValue: [] as GuardrailOverview[],
    fetcher: async (orgId) => {
      return await guapApi.guardrails.list({ organizationId: orgId });
    },
  });

  const [intentFilter, setIntentFilter] = createSignal<string>('all');

  const rows = createMemo<GuardrailRow[]>(() =>
    guardrailsQuery
      .data()
      .map((guardrail) => {
        const managePath = routeForIntent(guardrail.intent);
        const autoLimit = guardrail.autoApproveUpToCents ?? guardrail.maxOrderAmountCents ?? null;

        let extra: string | null = null;
        if (guardrail.intent === 'invest') {
          const instruments = guardrail.allowedInstrumentKinds?.length
            ? guardrail.allowedInstrumentKinds.join(', ')
            : null;
          if (instruments) {
            extra = `Allowed instruments: ${instruments}`;
          }
        }

        return {
          id: guardrail.id,
          intent: guardrail.intent,
          intentLabel: formatIntent(guardrail.intent),
          scopeLabel: guardrail.scope.label,
          approvalPolicy: policyLabel(guardrail.approvalPolicy, autoLimit),
          autoLimit: autoLimit != null ? formatCurrency(autoLimit) : '—',
          extra,
          updatedAt: guardrail.updatedAt,
          managePath,
        } satisfies GuardrailRow;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  );

  const filteredRows = createMemo(() => {
    if (intentFilter() === 'all') {
      return rows();
    }
    return rows().filter((row) => row.intent === intentFilter());
  });

  const intentOptions = createMemo(() => {
    const uniqueIntents = Array.from(new Set(rows().map((row) => row.intent)));
    return ['all', ...uniqueIntents];
  });

  const status = createMemo(() => {
    if (guardrailsQuery.isLoading()) return 'loading' as const;
    if (guardrailsQuery.error()) return 'error' as const;
    if (!rows().length) return 'empty' as const;
    return 'success' as const;
  });

  const tableColumns = [
    columnHelper.accessor('intentLabel', {
      header: 'Intent',
      meta: { width: '16%' },
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('scopeLabel', {
      header: 'Scope',
      meta: { width: '26%' },
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('approvalPolicy', {
      header: 'Approval policy',
      meta: { width: '22%' },
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('autoLimit', {
      header: 'Auto limit',
      meta: { width: '14%' },
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('extra', {
      header: 'Notes',
      meta: { width: '18%' },
      cell: (info) => info.getValue() ?? '—',
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      meta: { width: '8%' },
      cell: (info) => {
        const path = info.row.original.managePath;
        return (
          <Show
            when={path}
            fallback={<span class="text-xs text-slate-400">—</span>}
          >
            {(resolvedPath) => (
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => router.navigate({ to: resolvedPath() })}
              >
                Manage
              </Button>
            )}
          </Show>
        );
      },
    }),
  ];

  return (
    <div class="flex flex-col gap-6">
      <header class="space-y-2">
        <h1 class="text-2xl font-semibold text-slate-900">Guardrails</h1>
        <p class="text-sm text-slate-500">
          Review approval policies across intents and jump to the surface responsible for managing each guardrail.
        </p>
      </header>

      <DataState
        status={status()}
        loadingFallback={
          <div class="space-y-3">
            <For each={[0, 1, 2]}>{() => <div class="h-16 animate-pulse rounded-2xl bg-slate-100" />}</For>
          </div>
        }
        emptyFallback={
          <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Guardrail policies will appear here after you configure budgets, donations, or investing limits.
          </div>
        }
        errorFallback={
          <div class="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">
            Unable to load guardrail overview right now.
          </div>
        }
      >
        <DataTable
          data={filteredRows()}
          columns={tableColumns}
          toolbar={{
            filters: intentOptions().map((intent) => ({
              id: intent,
              label: intent === 'all' ? 'All intents' : formatIntent(intent),
              active: intentFilter() === intent,
              onToggle: () => setIntentFilter(intent === intentFilter() ? 'all' : intent),
            })),
            summary: (items: GuardrailRow[]) => (
              <span>{items.length} guardrail{items.length === 1 ? '' : 's'}</span>
            ),
          }}
        />
      </DataState>
    </div>
  );
};

export default GuardrailSettingsPage;
