# Financial Surfaces MVP Plan

Goal: evolve Money Map allocations into actionable Earn, Save, Spend, Donate, and Invest surfaces without bloating schemas, while keeping provider integration swappable for future real-money accounts.

---

## Current Foundation Snapshot

Money Map already captures household allocations and approval flows through Convex domains, shared Zod types, and a virtual provider adapter. Auth is powered by Better Auth, households map to orgs, and frontend routing follows the feature pod pattern (`features/<feature>/pages|components|state|api|utils`). No other financial surfaces exist yet, so we can grow deliberately from this baseline.

## Core MVP Primitives

- **FinancialAccount**: canonical record per household account with kind (`checking`, `hysa`, `utma`, `donation`, `credit`), status, provider linkage, Money Map node reference, and current/available balances.
- **AccountSnapshot**: daily (or manual) balance snapshots per account for charting hero metrics without replaying every transaction.
- **AllocationRule**: (derived) normalized view of Money Map edges/rules describing default routing percentages from income or parent accounts; no standalone table, but shared utilities will compute it for simulations and transfer planning.
- **Transfer**: append-only money movements between accounts (manual or automated) with booking timestamps and audit linkage.
- **Transaction**: spend or deposit events with category, source, allocation, and enrichment metadata; categories roll up to budget groups.
- **CategoryRule**: household-level classifier tying merchants/text patterns to categories and needs-vs-wants grouping to keep auto-categorization simple.
- **Budget**: monthly envelope per category with planned amount, available, rollover preference, and link back to Money Map pod if relevant.
- **IncomeStream**: allowance, job, or chore definition with cadence, amount, and fulfillment status; feeds Earn projections.
- **SavingsGoal**: target amount, linked account, timeline assumptions, progress metrics, and optional reward hooks.
- **InvestmentPosition**: holdings per UTMA/brokerage account with instrument symbol, quantity, cost basis, and market value.
- **InvestmentOrder**: queued or historical buy/sell instructions, tied to positions and reconciled via provider sync.
- **WatchlistEntry**: tracked instrument metadata per student for Invest discovery without polluting real positions.
- **EventsJournal**: append-only sequence of audit and notification events with typed payloads for cross-surface toasts, activity feeds, and compliance.
- **NotificationPreference**: per profile settings that decide which EventsJournal entries bubble to the UI or messaging surfaces.

These primitives sit in focused Convex domains (`accounts`, `transactions`, `savings`, `budgets`, `investing`, `events`, `earn`) with mirrored packages in `packages/types` and `packages/api`.

> **Implementation status:** `accounts`, `transactions`, `transfers`, and `events` domains now back the provider sync flow with guardrail seeding, and the frontend AppData provider reads those APIs for live balances and approvals. Remaining domains (`budgets`, `earn`, `savings`, `investing`, `donate`) will be implemented across upcoming milestones.

## Provider Integration Strategy

Start with the existing virtual provider adapter and extend it to issue deterministic account, transaction, and market data per household. Provider contracts stay in `packages/providers`, so moving to real bank, card, or brokerage partners later only swaps implementations. Each financial domain fetches provider data through a shared `syncAccounts` mutation that writes hardened records (`FinancialAccount`, `Transaction`, `InvestmentPosition`) before emitting EventsJournal entries for downstream surfaces.

## Append-only Events Journal

Create `events` domain with a single Convex mutation to record typed events (`account_linked`, `transfer_created`, `goal_reached`, `order_submitted`, etc.). Events store ISO timestamps, actor (parent/student/system), household scope, domain payload, and read-state per profile. Notifications read from this log with cursor-based pagination; audit trails simply filter the same data set. No deletes or updates; corrections are new events referencing prior event ids.

## Feature MVP Definitions

### Money Map

- Canvas remains the planning surface for incomes, accounts, pods, goals, and liabilities, driven by `moneyMapNodes`, `moneyMapEdges`, and `moneyMapRules`.
- Saving the map writes to `financialAccounts`, `budgets`, and `savingsGoals` while logging `eventsJournal` entries for approvals.
- Approved edges seed `transferGuardrails`, defining where funds auto-route versus require explicit parent approval.
- Students continue to sketch futures in draft mode; submitting a change request packages the graph and routes to parents for review.
- Parents see diff-aware approvals, accept or decline, and the live runtime reflects the decision immediately.
- Students can withdraw a pending request, which cancels the submission and unlocks the canvas for further edits.

#### User Stories

- As a student, I can add or adjust nodes and flows on the Money Map, see simulations update live, and either keep working or submit a change request that waits for parent approval (writes `moneyMapChangeRequests` and locks the canvas until resolved or withdrawn).
- As a parent/admin, I receive a notification (`eventsJournal`) when a change request is submitted, open the approval panel to compare the proposed graph to the last approved snapshot, and approve or decline, which syncs `financialAccounts`, `budgets`, `savingsGoals`, and the associated `transferGuardrails`.
- As a student, I can withdraw a pending request to continue iterating; the request is marked `'withdrawn'`, the lock clears, and I can resubmit whenever I’m ready.
- As a household, whenever we link a real account or complete a transfer in Earn/Save/Spend, the Money Map automatically highlights the corresponding node and updates balances/edges so the plan and reality stay in sync.
- As a parent/admin, I can view and adjust guardrails directly from the Money Map or settings to control auto-transfer policies, investment restrictions, and approval thresholds.

### Earn

- Hero: total monthly earnings, next expected payout, and streak of completed chores or jobs.
- IncomeStreams list showing allowance, chores, and job entries with status (scheduled, pending approval, paid).
- Quick add/edit of income streams (amount, cadence, allocation target) gated by parent approvals, including optional auto-scheduling that respects guardrails.
- Activity timeline generated from EventsJournal to show recent payouts and approvals.
- Projection widget estimating next goal completion date using AllocationRules and current earnings velocity.

#### User Stories

- As a student, I can request a new income stream or log that a chore is complete, triggering a `transfers` draft with `intent = 'earn'` and consulting guardrails to auto-approve if allowed; otherwise my parent is notified.
- As a parent/admin, I review pending earnings, approve them, and see the approved transfer route funds into the destinations defined in the Money Map (`budgets`, `savingsGoals`) while the Earn page marks the payout as complete.
- As a parent/admin, I configure which income streams auto-schedule (e.g., weekly allowance) and which require manual confirmation, adjusting guardrails when necessary.
- As a student, I view my earnings streak and projected goal completion powered by `incomeStreams`, `transfers`, and allocation rules; changing allocations on the Money Map immediately recalculates my projection.

### Save (HYSA)

- Hero: combined HYSA balance and 30-day growth sparkline sourced from AccountSnapshots.
- SavingsGoal board with progress bars, estimated completion, and ability to nudge allocation percentages.
- Transfer flow to move funds between checking and HYSA with parent approval hooks and provider sync.
- Contribution history table pulling from Transfers and Transactions filtered to savings accounts.
- Chart.js (or lightweight alternative) line chart comparing planned vs actual contributions per goal.

#### User Stories

- As a student, I create a new savings goal tied to a Money Map goal node, specify a target, and watch progress update as transfers tagged with that goal post to the HYSA account.
- As a student, I initiate a transfer from checking to HYSA, optionally attach it to a goal, and submit it; guardrails auto-approve transfers that stay within the preset limits, while larger or reversed flows require parent approval.
- As a parent, I adjust a goal’s allocation in the Money Map or on the Save page, and both surfaces stay in sync while projections recalculate using `accountSnapshots` and `transfers`.

### Spend (Checking & Secured Credit)

- Hero: current spend this period, available cash (checking) and remaining credit (secured card), plus simple burn-rate indicator.
- Unified Transactions table with search, sort (amount/date), and filters for All, Category, Type (card vs ACH), and Needs vs Wants leveraging CategoryRules and Budgets.
- Needs vs Wants breakdown with donut chart and delta versus target budget.
- Budget summary cards showing plan vs actual and quick parent override for limits.
- Credit payoff flow creating Transfer + Transaction pair (`pay_credit_card`) with audit events.

#### User Stories

- As a student, I review all recent transactions across checking and secured credit accounts, filter by category or needs vs wants, and see how each aligns with the Money Map pods and budgets.
- As a student, I search transactions by merchant name, sort by amount or date, and pivot between All/Card/ACH views using the shared table controls.
- As a parent/admin, I adjust a pod’s budget limit or guardrail from Spend, which updates the associated Money Map pod and raises an `eventsJournal` entry if the household is already over the limit.
- As a student, I initiate a credit card payoff from Spend, which schedules a `transfer` (intent `credit_payoff`) and auto-executes if the payoff fits guardrail thresholds; otherwise it stays pending until a parent approves, after which the liability balance updates everywhere.

### Donate

- Hero: total donated this year, goal progress toward parent-defined generosity target.
- Recommended causes or household-approved nonprofits using Watchlist-style entries synced from provider stub or static config.
- Donation scheduling flow that spins up Transfer records into donation accounts and emits approval events.
- Impact timeline combining Transfers and EventsJournal entries tagged `donation`.

#### User Stories

- As a student, I explore approved causes, schedule a donation, and see it auto-approve or move into pending status depending on guardrails; once executed, the donation logs to `transfers`, updates the Donate goal, and appears on the Money Map donation node.
- As a parent/admin, I set or edit the annual donation target, control which causes are available, and review the donation timeline for audit purposes via `eventsJournal`.
- As a student, I compare my generosity progress against the goal and see the estimated completion date adjust when new income allocations or transfers are approved.

### Invest (UTMA)

- Hero: portfolio total, daily change, and growth percent derived from InvestmentPositions and recent price snapshots.
- Holdings table with cost basis, market value, gain/loss, and allocation percentage; clicking opens detail drawer.
- Watchlist grid showing trending ETFs/stocks with simple price trend sparkline and ability to add/remove instruments.
- Buy/Sell flow creating InvestmentOrders pending parent approval before provider execution.
- Education callouts (static content) referencing Money Map nodes tagged for investing to keep context.

#### User Stories

- As a student, I review current holdings, tap into a detail drawer to see performance, and submit a buy or sell order; guardrails auto-approve ETF orders under the parent-defined threshold while other symbols or amounts queue for approval.
- As a parent/admin, I approve or decline investment orders, after which the system executes a transfer, updates `investmentPositions`, and reflects the change in the Money Map brokerage node and Invest hero metrics.
- As a student, I manage a watchlist of symbols, compare them to my Money Map investing allocations, and simulate potential impact before requesting an order.

### Dashboard & Liabilities

- Dashboard aggregates hero metrics from Earn, Save, Spend, Invest, Donate, and outstanding liabilities, showing quick deltas versus plans.
- Liability cards surface balances, minimum payments, and payoff trajectories using `liabilityTerms`, `accountSnapshots`, and planned flows.
- Cross-surface nav drives teens into deeper workflow tabs while keeping the Money Map status visible.

#### User Stories

- As a student, I open the dashboard to see total cash, savings, investments, and debts with quick trends; clicking any metric takes me to the respective surface with the same dataset.
- As a parent/admin, I monitor upcoming payments (credit card due dates, loan installments) sourced from `liabilityTerms`, money map flows, and guardrails, and I can trigger a payoff or adjust the payment guardrail directly from the dashboard.
- As a household, when we approve transfers, update goals, or change allocations in any surface, the dashboard and Money Map synchronize within one refresh, reinforcing that the plan, guardrails, and real-world ledger stay aligned.
- As a parent/admin, I open the approvals inbox to review pending transfers and invest orders, while the activity feed lists recent events sourced from `eventsJournal`.

## Cross-cutting Considerations

- Charts: prefer `chart.js` via a thin Solid wrapper under `shared/components/charts` to keep charting consistent.
- Forecasting: simple linear projection using rolling 30-day averages; store computed results per request, not in DB.
- Permissions: reuse Better Auth role mapping (owner/admin/member) with middleware in each Convex domain.
- Accessibility: all new pages live under `features/<surface>` with consistent hero component API to keep app shell simple.

## Shared UX & Systems

### UI State Patterns

- Build a `DataState` component that renders loading skeletons, empty state illustrations, error messaging (with retry handlers), or the ready state in a single place.
- Provide skeleton primitives (`PageSkeleton`, `TableSkeleton`, `StatSkeleton`) under `shared/components/state` so features don’t rebuild shimmering div stacks.
- Standardise empty and no-access states with iconography + copy templates (`EmptyState`, `NoAccessState`) fed by feature-specific props.

### Error Handling

- Add `shared/services/errors.ts` with `reportError(error, context)` to capture feature/action metadata and forward to console + `eventsJournal` (later external telemetry).
- Export `getFriendlyErrorMessage` to translate technical failures into user-facing copy; wire it into toasts and empty states.
- Introduce a reusable Solid error boundary wrapper (`ErrorBoundary` component) for route-level fallbacks plus a `withRetry(fn)` helper for optimistic retries.

### Data Fetching & Caching

- Adopt `@tanstack/solid-query` for queries/mutations; expose `createGuapQuery` / `createGuapMutation` wrappers that auto-inject auth headers, feature-based query keys, and default stale times.
- Package pagination helpers (`buildCursorQuery`, `useInfiniteScroll`) and optimistic update utilities in `shared/data`.
- Keep a lightweight resource fallback (`createResourceState`) for cases where Convex reactivity is overkill (e.g., local calculations or derived-only state).

### Notifications

- Wrap `solid-sonner` in `shared/services/notifications.ts` with `notify.success|error|info|warning` to enforce copy, duration, and action button conventions.
- Support contextual actions (undo, view details) and ensure notifications also log to `eventsJournal` when appropriate.

### Forms & Validation

- Introduce `shared/forms` powered by TanStack Form, including a Zod resolver, submit-state handling, and utilities for optimistic disabling.
- Ship field components (`FormField`, `MoneyField`, `PercentField`, `SelectField`, `CheckboxField`) that bind TanStack Form state to our UI primitives (`Input`, `Select`, etc.).
- Provide `FormActions` and `FormSection` helpers for consistent button placement, descriptions, and error summaries.

### Tables & Data Views

- Create `shared/components/data-table` built on TanStack Table with default column definitions, sorting, pagination controls, and empty/error overlays.
- Expose reusable cell renderers (currency, percent, status badge) and toolbar patterns (search box, filter chips, view toggles) so Spend can deliver merchant search, needs-vs-wants filters, and sort-by-amount without bespoke wiring.

### Analytics & Activity Tracking

- Add `shared/services/analytics.ts` with `trackEvent(eventName, payload)` that mirrors the naming conventions used in `eventsJournal`.
- Auto-capture page views and key interactions; allow features to opt into additional granularity without reimplementing plumbing.
- Provide a shared `useHouseholdActivity` query + components backed by `eventsJournal` so every surface can render recent events and notifications consistently.

### Authorization Helpers

- Centralise permission checks in `shared/utils/permissions.ts` with `canAccess(feature, role)` and `canManageHousehold(...)`.
- Provide `PermissionGate` and `usePermission` to hide actions gracefully and feed the standardized “no access” state when users bump into restrictions.

### Layout & Containers

- Package layout primitives: `PageContainer`, `Section`, `MetricCard`, `SummaryList`, `Modal`, `Drawer`, all living under `shared/components/layout`.
- Keep spacing, typography, and icon placements consistent so each feature can snap together dashboards rapidly.
- Include a `StickyCTA` component for mobile flows (approvals, transfers) to avoid bespoke footers per surface.
- Provide shared shells for the approvals inbox (pending transfers/orders) and the household activity feed (eventsJournal timeline) so every domain surfaces requests and recent events consistently.

## Milestones

### Milestone 0 — Shared Foundations

**Objective:** establish the core domains, types, and provider scaffolding before building surfaces.

**DoD**
- `packages/types` exposes base schemas for FinancialAccount, Transaction, IncomeStream, SavingsGoal, InvestmentPosition, EventsJournal.
- Convex `accounts`, `transactions`, `earn`, `savings`, `investing`, `events` domain directories exist with empty mutations/queries and tests ready.
- Virtual provider updated to return account, transaction, and market fixtures aligned with new schemas.

**Tasks**
- Add shared enums/primitives (transaction type, category group, event kind, instrument type).
- Scaffold `createGuapApi` domains to fetch accounts, transactions, events.
- Wire Money Map nodes to seed FinancialAccount stubs during sync.
- Establish shared UX systems (DataState, error reporter, query/mutation wrappers, notifications, forms, data table, layout primitives) so feature teams can reuse them from the start.

### Milestone 1 — Accounts & Sync Backbone

**Objective:** persist provider data as FinancialAccounts and Transactions, ready for downstream surfaces.

**DoD**
- `accounts` domain exposes `syncAccounts`, `listAccounts`, `getAccount`, and writes AccountSnapshots.
- `transactions` domain ingests provider transactions, tags them with default categories, and logs events.
- Frontend shared store caches accounts and transactions via `createQuery` hooks under `shared/services`.

**Tasks**
- Implement append-only AccountSnapshots from sync job.
- Seed baseline CategoryRules from Money Map allocations.
- Render neutral Account List page in `features/app-sections` for smoke testing.

#### Provider Sync & Guardrails (Status)

- `syncAccounts` now calls the virtual provider, ensures a Money Map exists, auto-mints account nodes when provider data arrives first, upserts FinancialAccounts, captures daily AccountSnapshots, and derives default category rules from the household's pods when no rules exist yet.
- New accounts automatically seed account-scoped guardrails with an `auto` approval policy so transfers can flow without manual setup.
- Every sync logs an `account_synced` event (and guardrail updates log `guardrail_updated`) that surfaces in the activity feed drawer, keeping households aware of changes.
- Frontend AppData hydrates accounts from the Convex API and the app shell approvals drawer reads the live `transfers` queue (`pending_approval`).

### Milestone 2 — Save Surface Groundwork

**Objective:** deliver HYSA Save page with goals, transfers, and projections.

> **Status:** Implemented — the Save page now exposes the HYSA hero, goal board, transfer modal, and contribution history.

**DoD**
- `savings` domain manages SavingsGoal CRUD, projections, and transfer initiation.
- Transfer mutation writes Transfers + Events and triggers provider stub updates.
- `features/save/pages/SavePage.tsx` renders hero, goals board, transfer modal, and contribution chart.

**Tasks**
- Create Goal progress calculator using AccountSnapshots plus Transfers.
- Add `save` API client with hooks for goals and transfers.
- Record parent approval events when students request transfers.

### Milestone 3 — Spend Surface & Budgets

**Objective:** expose Spend page with categorized transactions, budgets, and credit payoff flow.

**DoD**
- `budgets` submodule (inside `transactions` domain) tracks monthly budgets and actuals.
- Transactions API supports filters (category, type, needs vs wants) and returns aggregated stats.
- `features/spend/pages/SpendPage.tsx` shows hero, budgets, needs vs wants chart, and transaction table.
- Credit payoff flow creates Transfer + Transaction pair with approval handling.

**Tasks**
- Implement simple auto-categorization rules (merchant pattern, amount thresholds).
- Expose category rule management (edit/override) for parents tied to Money Map pods.
- Build reusable `TransactionsTable` component with column toggles.
- Wire merchant search, sort, and needs-vs-wants filters through the shared table toolbar.
- Surface guardrail controls for spend-related accounts so parents can edit limits inline.
- Emit Events for overspend alerts and budget resets.

_Status: Backend budgets/liabilities/transactions APIs and the Spend surface are live with guardrail editing, transaction filtering, and credit payoff flow. Manual QA + overspend event tuning remain for follow-up._

### Milestone 4 — Invest Surface

**Objective:** enable UTMA investing views with holdings, watchlist, and order flow.

**DoD**
- `investing` domain stores InvestmentPositions, daily price snapshots, and handles buy/sell orders with approval states.
- Watchlist API allows CRUD per student and resolves market data via provider stub.
- `features/invest/pages/InvestPage.tsx` presents hero, holdings table, watchlist, and order drawer.

**Tasks**
- Extend provider to simulate market quotes and order fills.
- Build reusable chart component for holding performance.
- Emit Events for order submitted, approved, executed, and failed.

### Milestone 5 — Earn Surface

**Objective:** surface income streams, approvals, and payout history for teens.

**DoD**
- `earn` domain handles IncomeStream CRUD, payout scheduling, and completion logging.
- Earn API returns hero metrics (monthly total, next payout) and streak data.
- `features/earn/pages/EarnPage.tsx` renders hero, income list, request forms, and activity timeline.

**Tasks**
- Integrate AllocationRules to auto-route earnings into Save or Spend accounts.
- Use EventsJournal to notify parents of new requests or missed chores.
- Build auto-scheduling job for allowance/chore payouts that consults guardrails before creating transfers.
- Expose guardrail toggles (auto vs parent required) per income stream in the Earn UI.
- Add projections service estimating goal timelines based on rolling income.

### Milestone 6 — Donate Surface

**Objective:** provide a lightweight giving experience tied to donation accounts.

**DoD**
- Donation flows reuse Transfers with destination `donation` accounts and optional external receipt data.
- Donate page hero, goal tracker, recommended causes list, and history timeline exist under `features/donate`.
- EventsJournal emits `donation_requested` and `donation_completed` for audit trail.

**Tasks**
- Seed provider fixtures with a curated cause list.
- Allow parents to cap donation budgets via Budgets domain.
- Add thank-you note generator (static entry) to keep teens engaged.

### Milestone 7 — Insights, Notifications, and Polish

**Objective:** tie surfaces together with events, charts, and quality guardrails.

**DoD**
- EventsJournal feeds in-app notifications (toast + inbox) and exports CSV for audit.
- Shared chart components render across Save, Spend, Invest without duplication.
- `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass with new domains hooked into Money Map shell navigation.

**Tasks**
- Wire App Shell nav to new pages and gate behind feature flag until ready.
- Backfill historical AccountSnapshots for charts if missing.
- Document provider sync playbook and event taxonomy inside `.docs`.

---

Follow milestones sequentially, validating each with parents-admin vs student roles, and keep schemas lean by promoting derived metrics to runtime calculations instead of new tables. The EventsJournal plus provider abstraction give us the flexibility to iterate without backtracking.
