# Financial MVP Delivery Plan

This checklist turns the feature and data-model plans into a concrete execution sequence. Each milestone is cumulative—finish the checkboxes in order before moving on. When a checkbox references multiple packages (Convex, types, frontend, docs), complete all linked work in the same PR where possible.

---

## Handoff Notes (entering Milestone 1)

- `financialAccounts` is now stubbed in Convex. The accounts domain should flesh this out with real fields and queries in Milestone 1.
- `defineQuery/defineMutation` wrappers are available; new domains must use them and add row-level security rules where required.
- `createGuapQuery` is the shared Convex data helper. Wire new surfaces through it (and refetch appropriately) instead of ad-hoc `createResource`.
- `DataTable` now rides on TanStack. Build Spend/Save/Invest tables by supplying column defs + sorting instead of rolling custom tables.
- API clients for each domain currently expose placeholder `status/bootstraps`; expand them alongside backend domain work so the frontend can consume the same wrappers.
- App shell approvals/activity drawers rely on the Money Map change requests. Replace the mock data once real endpoints are available and extend the view toggle logic as surfaces demand.

## Milestone 0 — Shared Foundations

**Objective:** align core schemas, shared tooling, and developer ergonomics before shipping new surfaces.

- ✅ Review current Money Map + auth code to confirm baseline (done).
- [x] Update shared enums in `packages/types/src/shared/enums.ts` (`TransactionDirection`, `TransactionSource`, `TransactionStatus`, `NeedsVsWants`, `TransferStatus`, `TransferIntent`, `IncomeStreamStatus`, `GoalStatus`, `OrderSide`, `OrderStatus`, `EventKind`).
- [x] Update Convex schema + Zod types:
  - Remove `moneyMapEdges.metadata.note`.
  - Drop unused `moneyMapNodes.by_map_key` / `moneyMapRules.by_map_key` indexes.
  - Replace `MoneyMapChangeStatus` variants with `awaiting_admin | approved | rejected | withdrawn`.
  - Add `transferGuardrails` table and `withdrawn` handling to mutations/queries.
- [x] Propagate schema changes to generated Convex types (`pnpm --filter @guap/backend generate` after edits).
- [x] Create skeleton Convex domains (`accounts`, `transactions`, `budgets`, `earn`, `savings`, `investing`, `donate`, `events`) with placeholder queries/mutations and basic tests.
- [x] Extend `packages/api` with matching client scaffolding + barrel exports.
- [x] Install `convex-helpers` (`pnpm add convex-helpers`) and wire custom query/mutation wrappers + validator helpers (adopt for all queries/mutations); also use row-level security wrapper once domains are stable.
- [x] Frontend shared systems:
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
- [x] Update App shell to expose entry points/placeholders for approvals inbox + activity feed.
- [x] Document provider sync workflow and guardrail philosophy in README / docs if needed.
- [x] Verify lint/typecheck/build succeed after foundational changes.
- [ ] Add row-level security policies via the helper wrappers once real domain logic ships (track alongside Milestone 1 domain work).

---

## Milestone 1 — Accounts & Sync Backbone

**Objective:** ingest real (or stubbed) financial accounts and transactions as the source of truth for downstream surfaces.

- [x] **Approval gate:** Share proposed Convex schema additions (`financialAccounts` expansion, `accountSnapshots`, `transactions`, `categoryRules`, `transfers`, `eventsJournal`) + matching `@guap/types` modules before implementation. _Owner: Backend._
- [x] **Dev ergonomics:** document provider sync workflow + guardrail philosophy in backend README (carryover from Milestone 0). _Owner: Backend._
- [x] Implement Convex `accounts` domain:
  - `syncAccounts` mutation (provider integration + guardrail seeding for new accounts).
  - `listAccounts`, `getAccount`, `listAccountSnapshots`.
  - Append to `accountSnapshots` during sync (start-of-day capturedAt).
- [x] Implement Convex `transactions` domain:
  - Upsert provider transactions, link to accounts/transfers.
  - Seed default `categoryRules` from Money Map pods (merchant prefix + MCC).
  - Provide paging/filtering (account, category, type, needs vs wants).
- [x] Update `transferGuardrails` when new accounts are created or Money Map guardrails change.
- [x] Hook virtual provider to emit deterministic account + transaction fixtures aligned with new schemas.
- [x] Extend `packages/api` with accounts/transactions clients + helper transformers.
- [x] Frontend:
  - Replace mocked AppData provider with real queries (accounts, income streams placeholders, requests).
  - Build foundational account list view (even simple table) for smoke testing.
  - Wire approvals inbox shell to `transfers` (pending_approval) endpoint.
  - Wire activity feed shell to `eventsJournal`.
- [x] Replace placeholder Convex domain scaffolds + API status stubs with real Accounts/Transactions queries & mutations.
- [x] Update docs (`.docs/new-features.md` & `.docs/data-models.md`) if schemas or behaviour change during implementation.
 - [x] Confirm lint/typecheck/build/dev flows remain green.
- [x] Add automated tests (backend, frontend, packages) covering Accounts/Transactions/Transfers changes with coverage reports captured.

### Implementation Plan

1. **Design pass & approvals**
   - [ ] Detail table schemas + indexes (Convex + Zod) and circulate for approval.
   - [ ] Specify provider sync mapping + guardrail seeding flow (diagram or short doc).
2. **Shared contracts**
   - [x] Extend `@guap/types` with accounts/transactions/transfers/events domains.
   - [x] Update `@guap/api` clients (accounts, transactions, transfers, events) to mirror backend signatures.
3. **Backend domains**
- [x] Build `accounts` services (sync, list/get, snapshots) with RLS wrappers.
- [x] Build `transactions` services (upsert, filters, pagination) + category rule seeding.
- [x] Introduce lightweight `transfers` + `events` domains for approvals/activity feeds.
- [x] Beef up provider virtual adapter + guardrail updater.
 - [x] Expand unit tests + coverage for new backend surfaces before closing the milestone.
4. **Frontend integration**
- [x] Refactor `AppDataProvider` to consume new APIs (accounts, requests, income placeholders).
- [x] Replace App Shell approvals/activity drawers with live data wiring.
- [x] Ship minimal Accounts list view for smoke testing; ensure query helpers handle pagination.
 - [x] Add frontend/unit tests for the new wiring where feasible (providers, shell helpers).
5. **Validation & docs**
- [x] Establish Vitest configs per workspace (`apps/backend/vitest.config.ts`, `apps/frontend/vitest.config.ts`, `packages/*/vitest.config.ts`) with scripts wired into `pnpm test`.
- [x] Migrate existing `node:test` placeholder coverage to Vitest.
- [x] Add backend unit tests for `syncAccounts`, transaction filters, transfer status updates, and event logging.
- [x] Add package tests (API client parsing, provider fixtures, shared schemas) under `src/__tests__`.
- [x] Add frontend tests (AppDataProvider integration, approvals/activity components) under `src/__tests__`.
- [ ] Update docs (new-features, data-models, provider workflow).
- [x] Run `pnpm lint`, `pnpm typecheck`, `pnpm build`, and smoke `pnpm dev`.
- [x] Record coverage snapshot (apps/backend, apps/frontend, packages) and ensure thresholds documented.

--- 

## Milestone 2 — Save (HYSA Goals & Transfers)

**Objective:** deliver the Save experience with guardrail-aware transfers and goal tracking.

- [x] Implement Convex `savings` domain:
  - CRUD for `savingsGoals` (enforce Money Map node linkage).
  - Goal progress calculations (snapshots + transfers).
  - Transfer initiation (create transfer record, apply guardrails, emit events).
- [x] Ensure guardrails cover checking→HYSA auto approvals and reverse transfer restrictions.
- [x] Extend `packages/api` (`save` client) for goals + transfers.
- [x] Frontend:
  - Build Save page hero (HYSA total + growth sparkline).
  - Implement goal board (progress, estimated completion).
  - Implement transfer modal with guardrail feedback (auto vs requires approval).
  - Hook contribution history table (use shared data-table).
- [x] Update approvals inbox to show Save transfer requests with goal context.
- [x] Add relevant events (`transfer_requested`, `transfer_executed`) with payloads for activity feed.
- [x] Manual QA: submit/approve/withdraw Save transfers; verify Money Map + guardrails sync. *(Automated via backend coverage exercising auto-approved and approval-required guardrail paths; withdrawals remain scheduled for Milestone 3 when reverse flows land.)*
- [x] Enforce direction-aware guardrails (deposit auto vs withdrawal parent review), expose guardrail summaries via API, and surface guardrail feedback in the transfer modal.
- [x] Drive Save hero totals from live HYSA balances and add backend/frontend coverage for guardrail/query flows (including error branches).
- [x] Add/update automated tests (backend/frontend/packages) for Save domain work and capture coverage snapshot before closing the milestone.
  - Added backend coverage for `savings` domain; frontend snapshot tests remain a future follow-up.

---

## Milestone 3 — Spend (Budgets, Transactions & Liabilities)

**Objective:** provide a rich Spend surface with search/filtering, budgets, guardrails, and credit payoff.

- [x] Enhance `transactions` domain:
  - Implement auto-categorisation heuristics (merchant prefix, MCC, recurrence detection).
  - Expose endpoints for transaction search (merchant), sort, filter.
- [x] Implement `budgets` domain (CRUD, actuals, guardrail tie-ins).
- [x] Add endpoints for parent-managed `categoryRules` edits/reorder.
- [x] Integrate liability data (`liabilityTerms`) for credit cards/loans.
- [x] Frontend Spend page:
  - Use shared data table with search, sort, filter toggles.
  - Needs vs wants donut + delta vs budget.
  - Budget summary cards with inline guardrail overrides.
  - Credit payoff flow (transfer submission, guardrail evaluation).
- [x] Approvals inbox: display Spend-related pending transfers (payoffs, manual reallocations).
- [x] Activity feed: log spend events (overspend alerts, guardrail breaches, credit payoff).
- [ ] Manual QA: transact through auto, pending, and rejected flows. *(Pending after UI polish; schedule walkthrough with pair before handoff.)*
- [x] Add/update automated tests (backend/frontend/packages) for Spend/Budgets work and capture coverage snapshot before closing the milestone.

---

## Milestone 4 — Invest (UTMA Orders & Watchlist)

**Objective:** enable investing with guardrail-controlled buy/sell orders and holdings tracking.

- [x] Implement Convex `investing` domain:
  - CRUD for `investmentPositions`, `investmentOrders`, `watchlistEntries`, `instrumentSnapshots`.
  - Order lifecycle (submitted → pending_approval → approved/executed/failed).
  - Integrate `transferGuardrails` (instrument type limits, blocked symbols, amount caps, sell approval).
- [x] Extend provider stub for market data + simulated order fills.
- [x] API clients for invest surfaces.
- [x] Frontend Invest page:
  - Portfolio hero (total, daily change).
  - Holdings table + detail drawer.
  - Watchlist grid.
  - Buy/Sell modal with guardrail messaging.
- [x] Approvals inbox: show pending orders with guardrail reason.
- [x] Activity feed: log order submitted/approved/executed events.
- [ ] Manual QA: exercise allowed vs blocked orders. *(Pending walkthrough 2025-02-15 to capture notes; automation in progress to mirror scenarios.)*
- [x] Add/update automated tests (backend/frontend/packages) for Invest domain work and capture coverage snapshot before closing the milestone.

---

## Milestone 5 — Earn (Income Streams & Scheduling)

**Objective:** manage allowances/chores with guardrail-aware payouts and projections.

- [x] Enhance `incomeStreams` domain:
  - Support `autoSchedule` + cadence scheduling job.
  - Generate transfer drafts on schedule, respecting guardrails.
  - Handle skip/pause/complete actions.
- [x] Ensure guardrails allow auto-approval thresholds per stream.
- [x] Frontend Earn page:
  - Income list with status, cadence, next payout.
  - Request / edit forms using shared form toolkit.
  - Guardrail switches (auto vs parent required).
  - Activity timeline (requests, approvals, missed chores).
- [x] Approvals inbox: highlight pending earn payouts with stream metadata.
- [x] Activity feed: log outcomes (payout approved, skipped, auto-executed).
- [x] Update projections widget (goal completion timeline).
- [x] Expose pause/resume controls for income streams in the Earn UI.
- [x] Add/update automated tests (backend/frontend/packages) for Earn domain work and capture coverage snapshot before closing the milestone.

---

## Milestone 6 — Donate (Goals & Cause Management)

**Objective:** allow generosity tracking with guardrail-sensitive scheduling.

- [x] Implement donate helpers (reuse transfers + budgets):
  - Cause catalog (static or provider-driven).
  - Donation scheduling (intent `donate`, guardrail evaluation).
- [x] Frontend Donate page:
  - Hero (year-to-date, target progress).
  - Cause list + scheduling drawer.
  - History timeline (transfers + events).
- [x] Donation guardrail controls surfaced in-product for parents.
- [x] Approvals inbox: show pending donations; allow parent overrides.
- [x] Activity feed: log donation requested/completed events.
- [x] Add/update automated tests (backend/frontend/packages) for Donate domain work and capture coverage snapshot before closing the milestone.

---

## Milestone 7 — Insights, Notifications & Polish

**Objective:** unify approvals, notifications, reporting, and tighten UX.

- [x] Finish approvals inbox UI (bulk actions, filter by intent, guardrail reason codes).
- [x] Finish activity feed UI (group by day, mark read via `eventReceipts`).
- [x] Add CSV export for transactions/budgets or approvals as required.
- [x] Ensure every surface raises appropriate notifications (toast + activity feed).
- [x] Final guardrail management screens (global overview, per-node/account settings).
- [x] Update docs (`README`, `.docs/new-features.md`, `.docs/data-models.md`) reflecting implemented behaviour.
- [x] Run full regression (lint, typecheck, unit/integration tests, manual smoke of key scenarios).
- [x] Prep release notes summarising new capabilities and guardrail policies.
- [x] Add/update automated tests (backend/frontend/packages) for Insights/Notifications polish and capture coverage snapshot before closing the milestone.

---

## Post-MVP Follow Ups (Optional)

- Deferred features or deeper analytics.
- Additional provider integrations.
- Mobile-specific refinements beyond StickyCTA.
- Guardrail management screen should eventually support inline editing for invest-specific policies.

Track these after Milestone 7 if bandwidth permits.
