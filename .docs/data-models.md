# Financial Data Models

Goal: define the smallest set of persisted models needed to unlock Earn, Save, Spend, Donate, and Invest without duplicating Money Map logic or breaking provider swapability.

---

## Principles

- Reuse Money Map as the source of truth for household allocations; new tables only store live financial artefacts.
- Prefer append-only records; derive aggregates at read time instead of denormalising progress metrics.
- Reference Better Auth profiles (`profileId`) and organizations (`organizationId`) consistently for permissions.
- Keep provider-specific details inside `packages/providers`; persisted records track only stable identifiers and balances.

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

## Accounts Domain

### `financialAccounts`

Represents the live counterpart to a Money Map node.

- `_id: Id<'financialAccounts'>`.
- `organizationId: string`.
- `moneyMapNodeId: Id<'moneyMapNodes'>` (required to keep allocations aligned).
- `name: string`.
- `kind: AccountKind`.
- `status: AccountStatus`.
- `currency: string` (default `USD`).
- `balance: CurrencyAmount` (last synced balance).
- `available: CurrencyAmount | null` (credit/available balance).
- `provider: string` (`virtual`, `stripe`, etc.).
- `providerAccountId: string | null`.
- `lastSyncedAt: number | null`.
- `createdAt`, `updatedAt`.

Indexes:
- `by_organization_kind`: `[organizationId, kind]`.
- `by_provider`: `[provider, providerAccountId]`.

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
- `needsVsWants: NeedsVsWants`.
- `occurredAt: number` (provider posted or manual timestamp).
- `createdAt: number`.
- `metadata: Record<string, unknown> | null` (MCC, location, etc.).

Indexes:
- `by_account_time`: `[accountId, occurredAt]`.
- `by_org_category_time`: `[organizationId, categoryKey, occurredAt]`.

### `categoryRules`

Household-level auto-categorisation.

- `_id: Id<'categoryRules'>`.
- `organizationId: string`.
- `matchType: 'merchant_prefix' | 'merchant_exact' | 'mcc' | 'keywords'`.
- `pattern: string`.
- `categoryKey: string`.
- `needsVsWants: NeedsVsWants`.
- `priority: number` (higher wins).
- `createdByProfileId: string`.
- `createdAt: number`.
- `lastMatchedAt: number | null`.

Transactions fall back to a default taxonomy when no rule matches. Category taxonomy itself stays static in code for MVP (`@guap/types/shared/categories.ts`) to avoid another table.

## Budgets Domain

### `budgets`

Monthly envelopes per category.

- `_id: Id<'budgets'>`.
- `organizationId: string`.
- `categoryKey: string`.
- `periodKey: string` (`YYYY-MM`).
- `plannedAmount: CurrencyAmount`.
- `rollover: boolean`.
- `capAmount: CurrencyAmount | null` (hard limit).
- `moneyMapNodeId: Id<'moneyMapNodes'> | null` (links to envelope pods).
- `createdByProfileId: string`.
- `createdAt: number`.
- `archivedAt: number | null`.

Index: `by_org_period`: `[organizationId, periodKey]`.

Actual spend per budget is derived from `transactions` filtered by category and period.

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
- `defaultAllocation: Array<{ moneyMapNodeId: Id<'moneyMapNodes'>; percentage: number }>` (optional override).
- `requiresApproval: boolean`.
- `status: IncomeStreamStatus`.
- `nextScheduledAt: number | null`.
- `lastPaidAt: number | null`.
- `createdByProfileId: string`.
- `createdAt: number`.
- `updatedAt: number`.

Payout history lives in `transfers` with `intent = 'earn'` referencing `incomeStreamId` inside `metadata`.

## Savings Domain

### `savingsGoals`

Targets mapped to HYSA accounts or sub-allocations.

- `_id: Id<'savingsGoals'>`.
- `organizationId: string`.
- `accountId: Id<'financialAccounts'>`.
- `name: string`.
- `targetAmount: CurrencyAmount`.
- `startingAmount: CurrencyAmount`.
- `targetDate: number | null`.
- `autoContributionPercent: number | null`.
- `status: GoalStatus`.
- `createdByProfileId: string`.
- `createdAt: number`.
- `achievedAt: number | null`.
- `archivedAt: number | null`.

Progress is computed via `accountSnapshots` plus `transfers` that include `goalId`.

## Investing Domain

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

## Minimality Checklist

- Every new table either backs a required UI surface or enforces approvals/audit.
- Budgets, goals, and orders reference Money Map nodes or accounts instead of duplicating allocation data.
- EventsJournal is the single append-only source for activity feeds and notifications.
- Pricing history is the only global dataset; everything else remains scoped per household.
