# Financial MVP Delivery Plan

This checklist turns the feature and data-model plans into a concrete execution sequence. Each milestone is cumulative—finish the checkboxes in order before moving on. When a checkbox references multiple packages (Convex, types, frontend, docs), complete all linked work in the same PR where possible.

---

## Milestone 0 — Shared Foundations

**Objective:** align core schemas, shared tooling, and developer ergonomics before shipping new surfaces.

- ✅ Review current Money Map + auth code to confirm baseline (done).
- [ ] Update shared enums in `packages/types/src/shared/enums.ts` (`TransactionDirection`, `TransactionSource`, `TransactionStatus`, `NeedsVsWants`, `TransferStatus`, `TransferIntent`, `IncomeStreamStatus`, `GoalStatus`, `OrderSide`, `OrderStatus`, `EventKind`).
- [ ] Update Convex schema + Zod types:
  - Remove `moneyMapEdges.metadata.note`.
  - Drop unused `moneyMapNodes.by_map_key` / `moneyMapRules.by_map_key` indexes.
  - Replace `MoneyMapChangeStatus` variants with `awaiting_admin | approved | rejected | withdrawn`.
  - Add `transferGuardrails` table and `withdrawn` handling to mutations/queries.
- [ ] Propagate schema changes to generated Convex types (`pnpm --filter @guap/backend generate` after edits).
- [ ] Create skeleton Convex domains (`accounts`, `transactions`, `budgets`, `earn`, `savings`, `investing`, `donate`, `events`) with placeholder queries/mutations and basic tests.
- [ ] Extend `packages/api` with matching client scaffolding + barrel exports.
- [ ] Install `convex-helpers` (`pnpm add convex-helpers`) and wire custom query/mutation wrappers + validator helpers (adopt for all queries/mutations); also use row-level security wrapper once domains are stable.
- [ ] Frontend shared systems:
  - Build `DataState`, `PageSkeleton`, `TableSkeleton`, `StatSkeleton`.
  - Build lightweight fetch helpers around Convex queries/mutations (no TanStack Query); provide resource fallback utilities where necessary.
  - Implement `shared/forms` (TanStack Form + Zod resolver) and `FormField`/`FormActions`.
  - Implement `shared/components/data-table` with search box, filter chips, view toggles, column sorting (using Tanstack table)
  - Wrap `solid-sonner` in `shared/services/notifications`.
  - Add `shared/services/errors`, `reportError`, and `FriendlyErrorMessage`.
  - Add `shared/services/analytics` with `trackEvent`.
  - Create `shared/utils/permissions`, `PermissionGate`, `usePermission`.
  - Package layout primitives (`PageContainer`, `Section`, `MetricCard`, `SummaryList`, `Modal`, `Drawer`, `StickyCTA`).
  - Stand up shared approvals inbox and household activity feed shells backed by placeholder data.
- [ ] Update App shell to expose entry points/placeholders for approvals inbox + activity feed.
- [ ] Document provider sync workflow and guardrail philosophy in README / docs if needed.
- [ ] Verify lint/typecheck/build succeed after foundational changes.

---

## Milestone 1 — Accounts & Sync Backbone

**Objective:** ingest real (or stubbed) financial accounts and transactions as the source of truth for downstream surfaces.

- [ ] Implement Convex `accounts` domain:
  - `syncAccounts` mutation (provider integration + guardrail seeding for new accounts).
  - `listAccounts`, `getAccount`, `listAccountSnapshots`.
  - Append to `accountSnapshots` during sync (start-of-day capturedAt).
- [ ] Implement Convex `transactions` domain:
  - Upsert provider transactions, link to accounts/transfers.
  - Seed default `categoryRules` from Money Map pods (merchant prefix + MCC).
  - Provide paging/filtering (account, category, type, needs vs wants).
- [ ] Update `transferGuardrails` when new accounts are created or Money Map guardrails change.
- [ ] Hook virtual provider to emit deterministic account + transaction fixtures aligned with new schemas.
- [ ] Extend `packages/api` with accounts/transactions clients + helper transformers.
- [ ] Frontend:
  - Replace mocked AppData provider with real queries (accounts, income streams placeholders, requests).
  - Build foundational account list view (even simple table) for smoke testing.
  - Wire approvals inbox shell to `transfers` (pending_approval) endpoint.
  - Wire activity feed shell to `eventsJournal`.
- [ ] Update docs (`.docs/new-features.md` & `.docs/data-models.md`) if schemas or behaviour change during implementation.
- [ ] Confirm lint/typecheck/build/dev flows remain green.

---

## Milestone 2 — Save (HYSA Goals & Transfers)

**Objective:** deliver the Save experience with guardrail-aware transfers and goal tracking.

- [ ] Implement Convex `savings` domain:
  - CRUD for `savingsGoals` (enforce Money Map node linkage).
  - Goal progress calculations (snapshots + transfers).
  - Transfer initiation (create transfer record, apply guardrails, emit events).
- [ ] Ensure guardrails cover checking→HYSA auto approvals and reverse transfer restrictions.
- [ ] Extend `packages/api` (`save` client) for goals + transfers.
- [ ] Frontend:
  - Build Save page hero (HYSA total + growth sparkline).
  - Implement goal board (progress, estimated completion).
  - Implement transfer modal with guardrail feedback (auto vs requires approval).
  - Hook contribution history table (use shared data-table).
- [ ] Update approvals inbox to show Save transfer requests with goal context.
- [ ] Add relevant events (`transfer_requested`, `transfer_executed`) with payloads for activity feed.
- [ ] Manual QA: submit/approve/withdraw Save transfers; verify Money Map + guardrails sync.

---

## Milestone 3 — Spend (Budgets, Transactions & Liabilities)

**Objective:** provide a rich Spend surface with search/filtering, budgets, guardrails, and credit payoff.

- [ ] Enhance `transactions` domain:
  - Implement auto-categorisation heuristics (merchant prefix, MCC, recurrence detection).
  - Expose endpoints for transaction search (merchant), sort, filter.
- [ ] Implement `budgets` domain (CRUD, actuals, guardrail tie-ins).
- [ ] Add endpoints for parent-managed `categoryRules` edits/reorder.
- [ ] Integrate liability data (`liabilityTerms`) for credit cards/loans.
- [ ] Frontend Spend page:
  - Use shared data table with search, sort, filter toggles.
  - Needs vs wants donut + delta vs budget.
  - Budget summary cards with inline guardrail overrides.
  - Credit payoff flow (transfer submission, guardrail evaluation).
- [ ] Approvals inbox: display Spend-related pending transfers (payoffs, manual reallocations).
- [ ] Activity feed: log spend events (overspend alerts, guardrail breaches, credit payoff).
- [ ] Manual QA: transact through auto, pending, and rejected flows.

---

## Milestone 4 — Invest (UTMA Orders & Watchlist)

**Objective:** enable investing with guardrail-controlled buy/sell orders and holdings tracking.

- [ ] Implement Convex `investing` domain:
  - CRUD for `investmentPositions`, `investmentOrders`, `watchlistEntries`, `instrumentSnapshots`.
  - Order lifecycle (submitted → pending_approval → approved/executed/failed).
  - Integrate `transferGuardrails` (instrument type limits, blocked symbols, amount caps, sell approval).
- [ ] Extend provider stub for market data + simulated order fills.
- [ ] API clients for invest surfaces.
- [ ] Frontend Invest page:
  - Portfolio hero (total, daily change).
  - Holdings table + detail drawer.
  - Watchlist grid.
  - Buy/Sell modal with guardrail messaging.
- [ ] Approvals inbox: show pending orders with guardrail reason.
- [ ] Activity feed: log order submitted/approved/executed events.
- [ ] Manual QA: exercise allowed vs blocked orders.

---

## Milestone 5 — Earn (Income Streams & Scheduling)

**Objective:** manage allowances/chores with guardrail-aware payouts and projections.

- [ ] Enhance `incomeStreams` domain:
  - Support `autoSchedule` + cadence scheduling job.
  - Generate transfer drafts on schedule, respecting guardrails.
  - Handle skip/pause/complete actions.
- [ ] Ensure guardrails allow auto-approval thresholds per stream.
- [ ] Frontend Earn page:
  - Income list with status, cadence, next payout.
  - Request / edit forms using shared form toolkit.
  - Guardrail switches (auto vs parent required).
  - Activity timeline (requests, approvals, missed chores).
- [ ] Approvals inbox: highlight pending earn payouts with stream metadata.
- [ ] Activity feed: log outcomes (payout approved, skipped, auto-executed).
- [ ] Update projections widget (goal completion timeline).

---

## Milestone 6 — Donate (Goals & Cause Management)

**Objective:** allow generosity tracking with guardrail-sensitive scheduling.

- [ ] Implement donate helpers (reuse transfers + budgets):
  - Cause catalog (static or provider-driven).
  - Donation scheduling (intent `donate`, guardrail evaluation).
- [ ] Frontend Donate page:
  - Hero (year-to-date, target progress).
  - Cause list + scheduling drawer.
  - History timeline (transfers + events).
- [ ] Approvals inbox: show pending donations; allow parent overrides.
- [ ] Activity feed: log donation requested/completed events.

---

## Milestone 7 — Insights, Notifications & Polish

**Objective:** unify approvals, notifications, reporting, and tighten UX.

- [ ] Finish approvals inbox UI (bulk actions, filter by intent, guardrail reason codes).
- [ ] Finish activity feed UI (group by day, mark read via `eventReceipts`).
- [ ] Add CSV export for transactions/budgets or approvals as required.
- [ ] Ensure every surface raises appropriate notifications (toast + activity feed).
- [ ] Final guardrail management screens (global overview, per-node/account settings).
- [ ] Update docs (`README`, `.docs/new-features.md`, `.docs/data-models.md`) reflecting implemented behaviour.
- [ ] Run full regression (lint, typecheck, unit/integration tests, manual smoke of key scenarios).
- [ ] Prep release notes summarising new capabilities and guardrail policies.

---

## Post-MVP Follow Ups (Optional)

- Deferred features or deeper analytics.
- Additional provider integrations.
- Mobile-specific refinements beyond StickyCTA.

Track these after Milestone 7 if bandwidth permits.

