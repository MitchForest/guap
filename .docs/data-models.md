# Financial Data Models & TODOs

Goal: define the smallest set of persisted models needed to unlock Earn, Save, Spend, Donate, Invest, and Liabilities without duplicating Money Map logic or breaking provider swapability.

---

## Principles

- Reuse Money Map as the source of truth for household allocations; new tables only store live financial artefacts.
- Prefer append-only records; derive aggregates at read time instead of denormalising progress metrics.
- Reference Better Auth profiles (`profileId`) and organizations (`organizationId`) consistently for permissions.
- Keep provider-specific details inside `packages/providers`; persisted records track only stable identifiers and balances.

## Current Implementation Snapshot

- Convex now ships `accounts`, `transactions`, `transfers`, and `events` domains alongside `auth` and `moneyMaps`; remaining surfaces (budgets, earn, savings, investing, donate) are queued for later milestones.
- `moneyMapEdges.metadata.note` and the legacy `by_map_key` indexes still exist in Convex and Zod schemas today; migrations will remove them once ready.
- Shared financial enums (transaction directions, transfer intents/statuses, event kinds, etc.) live under `packages/types/src/shared/enums.ts` and power both schema definitions and runtime validation.
- The frontend AppData provider now consumes the real accounts API and the app shell drawers source pending transfers + events from Convex; Money Map change requests remain available for legacy approvals.

## Shared Primitives & Enums

- `CurrencyAmount`: `{ cents: number; currency: string }` (already defined).
- `OrgRef`: `organizationId: string` present on every household-scoped record.
- `ActorRef`: `profileId: string` for users; store `role` only when helpful in audit payloads.
- `MoneyMapLink`: `moneyMapNodeId: Id<'moneyMapNodes'>` or `moneyMapNodeKey: string` to tie back to allocations.
- `ProviderRef`: `{ provider: string; providerAccountId?: string }` reused by accounts and orders.
- New enums (to add under `@guap/types/shared`):
  - `TransactionDirection`: `debit | credit`.
  - `TransactionSource`: `provider | manual | transfer`.
  - `TransactionStatus`: `pending | posted`.
  - `NeedsVsWants`: `needs | wants | neutral`.
  - `TransferStatus`: `draft | pending_approval | approved | executed | declined | canceled`.
  - `TransferIntent`: `earn | save | spend | donate | invest | credit_payoff | manual`.
  - `IncomeStreamStatus`: `active | paused | archived`.
  - `GoalStatus`: `active | paused | achieved | archived`.
  - `OrderSide`: `buy | sell`.
  - `OrderStatus`: `pending | awaiting_parent | approved | executed | canceled | failed`.
  - `EventKind`: curated list (see Events section).

All timestamps are epoch milliseconds (`number`), matching existing Convex tables.

## Money Map Domain (Planning Layer)

Money Map remains the canonical planning surface. Runtime tables reference Money Map node ids to stay in sync.

### `moneyMaps`

- `_id: Id<'moneyMaps'>`
- `organizationId: string`
- `name: string`
- `description?: string`
- `createdAt`, `updatedAt`

Index: `by_organization` → `[organizationId]`

### `moneyMapNodes`

- `_id: Id<'moneyMapNodes'>`
- `mapId: Id<'moneyMaps'>`
- `key: string` (stable identifier in serialized snapshots)
- `kind: 'income' | 'account' | 'pod' | 'goal' | 'liability'`
- `label: string`
- `metadata` object:
  - `id?: string` (canvas-stable id)
  - `category?: string | null` (checking/savings/brokerage/etc.)
  - `parentId?: string | null` (pods/goals inherit parent account)
  - `podType?: 'goal' | 'category' | 'envelope' | 'custom' | null`
  - `icon?: string | null`
  - `accent?: string | null`
  - `balanceCents?: number | null` (planning hint, not authoritative)
  - `inflow?: { amount: number; cadence: 'monthly' | 'weekly' | 'daily' } | null`
  - `position?: { x: number; y: number }`
  - `returnRate?: number | null` (APY/annual return assumption; defaults to plan presets—0 for checking/liability nodes, 4% for HYSA until real rates sync, 7% for brokerage/UTMA until three months of performance unlocks realised returns)
- `createdAt`, `updatedAt`

Indexes:
- `by_map` → `[mapId]`
- `by_map_key` (currently unused)

### `moneyMapEdges`

- `_id: Id<'moneyMapEdges'>`
- `mapId: Id<'moneyMaps'>`
- `sourceKey: string`
- `targetKey: string`
- `metadata`:
  - `id?: string` (stable flow id)
  - `ruleId?: string`
  - `amountCents?: number | null` (planned flow amount)
  - `tag?: string` (UI label)
  - `note?: string` (currently unused)
- `createdAt`, `updatedAt`

Index: `by_map` → `[mapId]`

### `moneyMapRules`

- `_id: Id<'moneyMapRules'>`
- `mapId: Id<'moneyMaps'>`
- `key: string`
- `trigger: 'incoming' | 'scheduled'`
- `config`:
  - `ruleId?: string`
  - `sourceNodeId?: string`
  - `triggerNodeId?: string`
  - `allocations?: Array<{ targetNodeId: string; percentage: number }>`
- `createdAt`, `updatedAt`

Indexes:
- `by_map` → `[mapId]`
- `by_map_key` (currently unused)

### `moneyMapChangeRequests`

- `_id: Id<'moneyMapChangeRequests'>`
- `mapId: Id<'moneyMaps'>`
- `organizationId: string`
- `submitterId: string`
- `status: 'awaiting_admin' | 'approved' | 'rejected' | 'withdrawn'`
- `summary?: string`
- `payload` (full Money Map draft mirroring the tables above)
- `createdAt`, `resolvedAt?`, `updatedAt`

Indexes:
- `by_map_status` → `[mapId, status]` (not actively used but keeps moderation queries simple if needed)
- `by_organization_status` → `[organizationId, status]`

Implementation note: the backend currently queues requests in the `'awaiting_admin'` state. Students can withdraw pending requests (updating the status to `'withdrawn'`), which unlocks the canvas for further edits. Approved requests apply the snapshot immediately; rejected requests leave the proposed state visible so students can adjust and resubmit.

Planning data flows into runtime models through `moneyMapNodeId` links; runtime aggregates never mutate the Money Map tables directly. The creation flow works both ways:
- When parents sketch the Money Map first, we mint runtime records (`financialAccounts`, `budgets`, `savingsGoals`, etc.) from approved nodes.
- When provider sync discovers new accounts first, we create Money Map account nodes (with default metadata) so teens see reality reflected on the canvas and can adjust flows.

---

## Accounts Domain

### `financialAccounts`

Represents the live counterpart to an approved Money Map `account` node.

- `_id: Id<'financialAccounts'>`
- `organizationId: string`
- `moneyMapNodeId: Id<'moneyMapNodes'>` (required; 1:1 with account node)
- `name: string`
- `kind: AccountKind`
- `status: AccountStatus`
- `currency: string` (default `USD`)
- `balance: CurrencyAmount` (last synced balance)
- `available: CurrencyAmount | null` (credit/available balance)
- `provider: string` (`virtual`, `stripe`, etc.)
- `providerAccountId: string | null`
- `lastSyncedAt: number | null`
- `createdAt`, `updatedAt`

Indexes:
- `by_organization_kind`: `[organizationId, kind]`
- `by_provider`: `[provider, providerAccountId]`

### `accountSnapshots`

Daily snapshots feeding hero metrics and charts.

- `_id: Id<'accountSnapshots'>`.
- `organizationId: string`.
- `accountId: Id<'financialAccounts'>`.
- `capturedAt: number` (start-of-day timestamp).
- `balance: CurrencyAmount`.
- `available: CurrencyAmount | null`.
- `source: 'sync' | 'manual'`.
- `createdAt: number`.

Index: `by_account_time` → `[accountId, capturedAt]`.

## Transfers & Approvals Domain

### `transfers`

Single table capturing requests, approvals, and execution for moving money.

- `_id: Id<'transfers'>`.
- `organizationId: string`.
- `intent: TransferIntent`.
- `sourceAccountId: Id<'financialAccounts'> | null` (null for external inflow).
- `destinationAccountId: Id<'financialAccounts'>`.
- `amount: CurrencyAmount`.
- `requestedByProfileId: string`.
- `approvedByProfileId: string | null`.
- `status: TransferStatus`.
- `goalId: Id<'savingsGoals'> | null` (links Save flows).
- `orderId: Id<'investmentOrders'> | null` (links Invest execution).
- `requestedAt: number`.
- `approvedAt: number | null`.
- `executedAt: number | null`.
- `metadata: Record<string, unknown> | null` (memo, external reference).

Indexes:
- `by_organization_status`: `[organizationId, status]`.
- `by_destination_time`: `[destinationAccountId, requestedAt]`.

Transfers emit EventsJournal entries when status changes; actual ledger postings create `transactions` rows.

### `transferGuardrails`

Defines which transfers can execute automatically versus requiring parent/admin approval. Guardrails may apply at the organization, Money Map node, or account level.

- `_id: Id<'transferGuardrails'>`
- `organizationId: string`
- `scope: { type: 'organization' } | { type: 'money_map_node'; nodeId: Id<'moneyMapNodes'> } | { type: 'account'; accountId: Id<'financialAccounts'> }`
- `intent: TransferIntent`
- `direction: { sourceNodeId: string | null; destinationNodeId: string | null }` (Money Map node ids; null for external inflow/outflow)
- `approvalPolicy: 'auto' | 'parent_required' | 'admin_only'`
- `autoApproveUpToCents: number | null`
- `dailyLimitCents: number | null`
- `weeklyLimitCents: number | null`
- `allowedInstrumentKinds: Array<'etf' | 'stock' | 'bond' | 'cash'> | null` (invest-specific)
- `blockedSymbols: string[] | null` (invest-specific)
- `maxOrderAmountCents: number | null` (invest-specific)
- `requireApprovalForSell: boolean | null` (invest-specific)
- `allowedRolesToInitiate: Array<'owner' | 'admin' | 'member'>`
- `createdByProfileId: string`
- `createdAt: number`
- `updatedAt: number`

Indexes:
- `by_organization_intent`: `[organizationId, intent]`
- `by_scope_intent`: `[scope.type, intent]`

Guardrails are seeded from Money Map allocations when parents approve a change request and can be adjusted manually in settings. Every transfer request consults the applicable guardrail to decide whether to auto-approve, cap amounts, or require explicit review. Invest orders reuse the same guardrail record via the `invest` intent.

For Save flows specifically, the backend seeds two guardrails per goal node: deposits default to `auto` (with optional auto-approve limits) while withdrawals default to `parent_required`, ensuring savings outflows always collect an explicit review unless an account-level override loosens the policy.

## Transactions & Categorisation Domain

### `transactions`

Stores spend/deposit events across accounts.

- `_id: Id<'transactions'>`.
- `organizationId: string`.
- `accountId: Id<'financialAccounts'>`.
- `transferId: Id<'transfers'> | null`.
- `providerTransactionId: string | null`.
- `direction: TransactionDirection`.
- `source: TransactionSource`.
- `status: TransactionStatus`.
- `amount: CurrencyAmount` (positive numbers; direction handles sign).
- `description: string`.
- `merchantName: string | null`.
- `categoryKey: string | null` (from taxonomy below).
- `categoryConfidence: number | null` (0 - 1).
- `occurredAt: number` (provider posted or manual timestamp).
- `createdAt: number`.
- `metadata: Record<string, unknown> | null` (MCC, location, etc.).
- `moneyMapNodeId: Id<'moneyMapNodes'> | null` (resolved for pod-linked categories so Spend can highlight the matching allocation).

Indexes:
- `by_account_time`: `[accountId, occurredAt]`.
- `by_org_category_time`: `[organizationId, categoryKey, occurredAt]`.

Needs-vs-wants rolls up from the category taxonomy or household overrides; we compute it on read so the table stays lean.

### `categoryRules`

Household-level auto-categorisation.

- `_id: Id<'categoryRules'>`.
- `organizationId: string`.
- `matchType: 'merchant_prefix' | 'merchant_exact' | 'mcc' | 'keywords'`.
- `pattern: string`.
- `categoryKey: string`.
- `priority: number` (higher wins).
- `createdByProfileId: string`.
- `createdAt: number`.
- `lastMatchedAt: number | null`.
- `moneyMapNodeId: Id<'moneyMapNodes'> | null` (pods/categories that rules map to; null when using global taxonomy without a pod).

Transactions fall back to a default taxonomy when no rule matches. Default rules cover Money Map pod assignments, merchant prefix matches for known brands, MCC-based fallbacks, and recurrence detection for allowances/subscriptions. Category taxonomy itself stays static in code for MVP (`@guap/types/shared/categories.ts`) to avoid another table, but households can add or reorder rules as needed.

## Budgets Domain

### `budgets`

Monthly envelopes anchored to Money Map pod nodes. If a household never configures pods, we do not create budgets; actual spend still tracks via categories.

- `_id: Id<'budgets'>`
- `organizationId: string`
- `moneyMapNodeId: Id<'moneyMapNodes'>` (required; points to pod node)
- `periodKey: string` (`YYYY-MM`)
- `plannedAmount: CurrencyAmount`
- `rollover: boolean`
- `capAmount: CurrencyAmount | null` (hard limit; optional)
- `createdByProfileId: string`
- `createdAt: number`
- `archivedAt: number | null`

Index: `by_org_period` → `[organizationId, periodKey]`

Actual spend per budget is derived from `transactions` joined via `moneyMapNodeId` (or the node’s category mapping) within the same period. Overspend triggers `eventsJournal` entries and highlights the associated pod on the Money Map.

## Liabilities Domain

Liability surfaces (secured credit cards, informal IOUs, student loans, auto loans, mortgages) reuse `financialAccounts` with `kind: 'credit'` or `kind: 'liability'`. Additional terms sit alongside the account so projections and reminders stay accurate.

### `liabilityTerms`

- `_id: Id<'liabilityTerms'>`
- `organizationId: string`
- `accountId: Id<'financialAccounts'>` (must reference a liability/credit account)
- `liabilityType: 'secured_credit' | 'loan' | 'student_loan' | 'auto_loan' | 'mortgage' | 'other'`
- `originPrincipal: CurrencyAmount`
- `interestRate: number` (APR as decimal, e.g. 0.1999)
- `minimumPayment: CurrencyAmount`
- `statementDay: number | null` (1–31; null for loans without statements)
- `dueDay: number | null`
- `maturesAt: number | null` (timestamp when payoff/balloon occurs)
- `openedAt: number`
- `createdAt: number`
- `updatedAt: number`

Index: `by_account` → `[accountId]`

Outstanding balances continue to flow through `accountSnapshots` (positive numbers represent amount owed), while purchases and payments live in `transactions`. Payoffs triggered from Spend create `transfers` with `intent = 'credit_payoff'`. Money Map edges from cash accounts into liability nodes express the planned payment flow and seed reminders.

*(Optional later)* `liabilitySchedules` can store amortisation projections per period once we want fixed payment timeline visualisations; not required for the MVP.

## Earn Domain

### `incomeStreams`

Allowance, chores, or job definitions.

- `_id: Id<'incomeStreams'>`.
- `organizationId: string`.
- `ownerProfileId: string` (teen).
- `name: string`.
- `cadence: IncomeCadence`.
- `amount: CurrencyAmount`.
- `defaultDestinationAccountId: Id<'financialAccounts'> | null`.
- `requiresApproval: boolean`.
- `autoSchedule: boolean` (whether payouts are generated automatically per cadence).
- `status: IncomeStreamStatus`.
- `nextScheduledAt: number | null`.
- `lastPaidAt: number | null`.
- `createdByProfileId: string`.
- `createdAt: number`.
- `updatedAt: number`.

Payout history lives in `transfers` with `intent = 'earn'` referencing `incomeStreamId` inside `metadata`. When `autoSchedule` is true, the earn domain generates transfer drafts on schedule, subject to guardrails.

## Savings Domain

### `savingsGoals`

Mental allocations tied to Money Map goal nodes but funded by real savings accounts.

- `_id: Id<'savingsGoals'>`
- `organizationId: string`
- `moneyMapNodeId: Id<'moneyMapNodes'>` (required; points to goal node)
- `accountId: Id<'financialAccounts'>` (parent HYSA account)
- `name: string`
- `targetAmount: CurrencyAmount`
- `startingAmount: CurrencyAmount`
- `targetDate: number | null`
- `status: GoalStatus`
- `createdByProfileId: string`
- `createdAt: number`
- `achievedAt: number | null`
- `archivedAt: number | null`

Progress is computed via `accountSnapshots` plus `transfers` tagged with `goalId`. Goal nodes stay in sync with runtime progress so the Money Map canvas can visualize projected completion dates.

## Investing Domain

_Status: Tables live in Convex with auto-executed buys, parent approvals, and watchlist snapshots._

### `investmentPositions`

Aggregated holdings per UTMA/brokerage account.

- `_id: Id<'investmentPositions'>`.
- `organizationId: string`.
- `accountId: Id<'financialAccounts'>`.
- `symbol: string`.
- `instrumentType: 'equity' | 'etf' | 'cash'`.
- `quantity: number` (supports fractional).
- `averageCost: CurrencyAmount`.
- `marketValue: CurrencyAmount`.
- `lastPrice: CurrencyAmount`.
- `lastPricedAt: number`.
- `metadata: Record<string, unknown> | null` (CUSIP, exchange).
- `updatedAt: number`.

### `investmentOrders`

Tracks buy/sell flows and approval states.

- `_id: Id<'investmentOrders'>`.
- `organizationId: string`.
- `accountId: Id<'financialAccounts'>`.
- `symbol: string`.
- `side: OrderSide`.
- `quantity: number`.
- `orderType: 'market'` (MVP).
- `limitPrice: CurrencyAmount | null`.
- `status: OrderStatus`.
- `placedByProfileId: string`.
- `approvedByProfileId: string | null`.
- `submittedAt: number`.
- `approvedAt: number | null`.
- `executedAt: number | null`.
- `executionPrice: CurrencyAmount | null`.
- `transferId: Id<'transfers'> | null`.
- `metadata: Record<string, unknown> | null`.

### `watchlistEntries`

- `_id: Id<'watchlistEntries'>`.
- `organizationId: string`.
- `profileId: string`.
- `symbol: string`.
- `createdAt: number`.
- `notes: string | null`.

### `instrumentSnapshots`

Global price cache for charts (shared across households).

- `_id: Id<'instrumentSnapshots'>`.
- `symbol: string`.
- `capturedAt: number`.
- `price: CurrencyAmount`.
- `source: string` (`virtual`, `iex`, etc.).

Index: `by_symbol_time`: `[symbol, capturedAt]`.

## Donate Domain

No new table required beyond `transfers` (`intent = 'donate'`) and `budgets`. Recommended causes can live in static config or, if parent customisation is needed later, a lightweight `donationCauses` table mirroring `watchlistEntries`. For MVP we keep it static.

## Events & Notifications Domain

### `eventsJournal`

Authoritative append-only log powering notifications and audit.

- `_id: Id<'eventsJournal'>`.
- `organizationId: string`.
- `eventKind: EventKind` (e.g. `account_synced`, `transfer_requested`, `transfer_executed`, `goal_achieved`, `order_submitted`, `budget_over_limit`, `income_request`, `donation_completed`).
- `actorProfileId: string | null` (system events are null).
- `primaryEntity: { table: string; id: string }`.
- `relatedEntities: Array<{ table: string; id: string }>` (optional).
- `payload: Record<string, unknown>` (serialised snapshot).
- `createdAt: number`.

Events are immutable; corrections add new events referencing the prior `eventId` in payload.

### `eventReceipts`

Separates read tracking from the journal to preserve append-only semantics.

- `_id: Id<'eventReceipts'>`.
- `eventId: Id<'eventsJournal'>`.
- `profileId: string`.
- `deliveredAt: number`.
- `readAt: number | null`.

Index: `by_profile_event`: `[profileId, eventId]`.

### `notificationPreferences`

- `_id: Id<'notificationPreferences'>`.
- `profileId: string`.
- `channel: 'in_app' | 'email' | 'sms'`.
- `eventKind: EventKind`.
- `enabled: boolean`.
- `createdAt: number`.
- `updatedAt: number`.

## Derived Views & Integrations

- **Allocation rules**: No new table; derive from `moneyMapRules` + `moneyMapEdges` when scheduling transfers or projecting goal timelines.
- **Budgets vs Money Map**: Budgets optionally link to Money Map envelope nodes via `moneyMapNodeId`, enabling UI rollups without duplicating structure.
- **Hero metrics & charts**: Compose from `financialAccounts`, `accountSnapshots`, and `transactions`. Avoid storing computed totals.
- **Provider sync**: A shared `syncAccounts` mutation writes to `financialAccounts`, `accountSnapshots`, `transactions`, `investmentPositions`, and emits `eventsJournal` entries. Sync health metadata (last run, errors) can remain in memory or log events (`eventKind = 'sync_failed'`) until we need dedicated tables.
- **Approvals inbox**: Filter `transfers` (and related `investmentOrders`) by `status = 'pending_approval'` with guardrail metadata to power the parent review queue.
- **Activity feed**: Query `eventsJournal` (optionally joined with `eventReceipts`) for recent events to display household activity timelines and notification badges.

## Minimality Checklist

- Every new table either backs a required UI experience or enforces approvals/audit.
- Budgets, goals, and orders reference Money Map nodes or accounts instead of duplicating allocation data.
- EventsJournal remains the single append-only source for activity feeds and notifications.
- Pricing history (`instrumentSnapshots`) is the only global dataset; everything else is household scoped.
- `financialAccounts` stores only real accounts (no pods/goals); auto-created provider accounts sync their Money Map node linkage after approval.
- `transactions` stay normalized—direction, source, and needs-vs-wants context derive from shared enums and the category taxonomy rather than extra columns.
