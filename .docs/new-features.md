# Financial Surfaces MVP Plan

Goal: evolve Money Map allocations into actionable Earn, Save, Spend, Donate, and Invest surfaces without bloating schemas, while keeping provider integration swappable for future real-money accounts.

---

## Current Foundation Snapshot

Money Map already captures household allocations and approval flows through Convex domains, shared Zod types, and a virtual provider adapter. Auth is powered by Better Auth, households map to orgs, and frontend routing follows the feature pod pattern (`features/<feature>/pages|components|state|api|utils`). No other financial surfaces exist yet, so we can grow deliberately from this baseline.

## Core MVP Primitives

- **FinancialAccount**: canonical record per household account with kind (`checking`, `hysa`, `utma`, `donation`, `credit`), status, provider linkage, Money Map node reference, and current/available balances.
- **AccountSnapshot**: daily (or manual) balance snapshots per account for charting hero metrics without replaying every transaction.
- **AllocationRule**: normalized edge from Money Map describing default routing percentages from income or parent accounts into destinations; used to seed transfers and goal projections.
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

## Provider Integration Strategy

Start with the existing virtual provider adapter and extend it to issue deterministic account, transaction, and market data per household. Provider contracts stay in `packages/providers`, so moving to real bank, card, or brokerage partners later only swaps implementations. Each financial domain fetches provider data through a shared `syncAccounts` mutation that writes hardened records (`FinancialAccount`, `Transaction`, `InvestmentPosition`) before emitting EventsJournal entries for downstream surfaces.

## Append-only Events Journal

Create `events` domain with a single Convex mutation to record typed events (`account_linked`, `transfer_created`, `goal_reached`, `order_submitted`, etc.). Events store ISO timestamps, actor (parent/student/system), household scope, domain payload, and read-state per profile. Notifications read from this log with cursor-based pagination; audit trails simply filter the same data set. No deletes or updates; corrections are new events referencing prior event ids.

## Feature MVP Definitions

### Earn

- Hero: total monthly earnings, next expected payout, and streak of completed chores or jobs.
- IncomeStreams list showing allowance, chores, and job entries with status (scheduled, pending approval, paid).
- Quick add/edit of income streams (amount, cadence, allocation target) gated by parent approvals.
- Activity timeline generated from EventsJournal to show recent payouts and approvals.
- Projection widget estimating next goal completion date using AllocationRules and current earnings velocity.

### Save (HYSA)

- Hero: combined HYSA balance and 30-day growth sparkline sourced from AccountSnapshots.
- SavingsGoal board with progress bars, estimated completion, and ability to nudge allocation percentages.
- Transfer flow to move funds between checking and HYSA with parent approval hooks and provider sync.
- Contribution history table pulling from Transfers and Transactions filtered to savings accounts.
- Chart.js (or lightweight alternative) line chart comparing planned vs actual contributions per goal.

### Spend (Checking & Secured Credit)

- Hero: current spend this period, available cash (checking) and remaining credit (secured card), plus simple burn-rate indicator.
- Unified Transactions table with filters for All, Category, and Type (card vs ACH) leveraging CategoryRules and Budgets.
- Needs vs Wants breakdown with donut chart and delta versus target budget.
- Budget summary cards showing plan vs actual and quick parent override for limits.
- Credit payoff flow creating Transfer + Transaction pair (`pay_credit_card`) with audit events.

### Donate

- Hero: total donated this year, goal progress toward parent-defined generosity target.
- Recommended causes or household-approved nonprofits using Watchlist-style entries synced from provider stub or static config.
- Donation scheduling flow that spins up Transfer records into donation accounts and emits approval events.
- Impact timeline combining Transfers and EventsJournal entries tagged `donation`.

### Invest (UTMA)

- Hero: portfolio total, daily change, and growth percent derived from InvestmentPositions and recent price snapshots.
- Holdings table with cost basis, market value, gain/loss, and allocation percentage; clicking opens detail drawer.
- Watchlist grid showing trending ETFs/stocks with simple price trend sparkline and ability to add/remove instruments.
- Buy/Sell flow creating InvestmentOrders pending parent approval before provider execution.
- Education callouts (static content) referencing Money Map nodes tagged for investing to keep context.

## Cross-cutting Considerations

- Charts: prefer `chart.js` via a thin Solid wrapper under `shared/components/charts` to keep charting consistent.
- Forecasting: simple linear projection using rolling 30-day averages; store computed results per request, not in DB.
- Permissions: reuse Better Auth role mapping (owner/admin/member) with middleware in each Convex domain.
- Accessibility: all new pages live under `features/<surface>` with consistent hero component API to keep app shell simple.

## Milestones

### Milestone 0 — Shared Foundations

**Objective:** establish the core domains, types, and provider scaffolding before building surfaces.

**DoD**
- [ ] `packages/types` exposes base schemas for FinancialAccount, Transaction, IncomeStream, SavingsGoal, InvestmentPosition, EventsJournal.
- [ ] Convex `accounts`, `transactions`, `earn`, `savings`, `investing`, `events` domain directories exist with empty mutations/queries and tests ready.
- [ ] Virtual provider updated to return account, transaction, and market fixtures aligned with new schemas.

**Tasks**
- [ ] Add shared enums/primitives (transaction type, category group, event kind, instrument type).
- [ ] Scaffold `createGuapApi` domains to fetch accounts, transactions, events.
- [ ] Wire Money Map nodes to seed FinancialAccount stubs during sync.

### Milestone 1 — Accounts & Sync Backbone

**Objective:** persist provider data as FinancialAccounts and Transactions, ready for downstream surfaces.

**DoD**
- [ ] `accounts` domain exposes `syncAccounts`, `listAccounts`, `getAccount`, and writes AccountSnapshots.
- [ ] `transactions` domain ingests provider transactions, tags them with default categories, and logs events.
- [ ] Frontend shared store caches accounts and transactions via `createQuery` hooks under `shared/services`.

**Tasks**
- [ ] Implement append-only AccountSnapshots from sync job.
- [ ] Seed baseline CategoryRules from Money Map allocations.
- [ ] Render neutral Account List page in `features/app-sections` for smoke testing.

### Milestone 2 — Save Surface Groundwork

**Objective:** deliver HYSA Save page with goals, transfers, and projections.

**DoD**
- [ ] `savings` domain manages SavingsGoal CRUD, projections, and transfer initiation.
- [ ] Transfer mutation writes Transfers + Events and triggers provider stub updates.
- [ ] `features/save/pages/SavePage.tsx` renders hero, goals board, transfer modal, and contribution chart.

**Tasks**
- [ ] Create Goal progress calculator using AccountSnapshots plus Transfers.
- [ ] Add `save` API client with hooks for goals and transfers.
- [ ] Record parent approval events when students request transfers.

### Milestone 3 — Spend Surface & Budgets

**Objective:** expose Spend page with categorized transactions, budgets, and credit payoff flow.

**DoD**
- [ ] `budgets` submodule (inside `transactions` domain) tracks monthly budgets and actuals.
- [ ] Transactions API supports filters (category, type, needs vs wants) and returns aggregated stats.
- [ ] `features/spend/pages/SpendPage.tsx` shows hero, budgets, needs vs wants chart, and transaction table.
- [ ] Credit payoff flow creates Transfer + Transaction pair with approval handling.

**Tasks**
- [ ] Implement simple auto-categorization rules (merchant pattern, amount thresholds).
- [ ] Build reusable `TransactionsTable` component with column toggles.
- [ ] Emit Events for overspend alerts and budget resets.

### Milestone 4 — Invest Surface

**Objective:** enable UTMA investing views with holdings, watchlist, and order flow.

**DoD**
- [ ] `investing` domain stores InvestmentPositions, daily price snapshots, and handles buy/sell orders with approval states.
- [ ] Watchlist API allows CRUD per student and resolves market data via provider stub.
- [ ] `features/invest/pages/InvestPage.tsx` presents hero, holdings table, watchlist, and order drawer.

**Tasks**
- [ ] Extend provider to simulate market quotes and order fills.
- [ ] Build reusable chart component for holding performance.
- [ ] Emit Events for order submitted, approved, executed, and failed.

### Milestone 5 — Earn Surface

**Objective:** surface income streams, approvals, and payout history for teens.

**DoD**
- [ ] `earn` domain handles IncomeStream CRUD, payout scheduling, and completion logging.
- [ ] Earn API returns hero metrics (monthly total, next payout) and streak data.
- [ ] `features/earn/pages/EarnPage.tsx` renders hero, income list, request forms, and activity timeline.

**Tasks**
- [ ] Integrate AllocationRules to auto-route earnings into Save or Spend accounts.
- [ ] Use EventsJournal to notify parents of new requests or missed chores.
- [ ] Add projections service estimating goal timelines based on rolling income.

### Milestone 6 — Donate Surface

**Objective:** provide a lightweight giving experience tied to donation accounts.

**DoD**
- [ ] Donation flows reuse Transfers with destination `donation` accounts and optional external receipt data.
- [ ] Donate page hero, goal tracker, recommended causes list, and history timeline exist under `features/donate`.
- [ ] EventsJournal emits `donation_requested` and `donation_completed` for audit trail.

**Tasks**
- [ ] Seed provider fixtures with a curated cause list.
- [ ] Allow parents to cap donation budgets via Budgets domain.
- [ ] Add thank-you note generator (static entry) to keep teens engaged.

### Milestone 7 — Insights, Notifications, and Polish

**Objective:** tie surfaces together with events, charts, and quality guardrails.

**DoD**
- [ ] EventsJournal feeds in-app notifications (toast + inbox) and exports CSV for audit.
- [ ] Shared chart components render across Save, Spend, Invest without duplication.
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass with new domains hooked into Money Map shell navigation.

**Tasks**
- [ ] Wire App Shell nav to new pages and gate behind feature flag until ready.
- [ ] Backfill historical AccountSnapshots for charts if missing.
- [ ] Document provider sync playbook and event taxonomy inside `.docs`.

---

Follow milestones sequentially, validating each with parents-admin vs student roles, and keep schemas lean by promoting derived metrics to runtime calculations instead of new tables. The EventsJournal plus provider abstraction give us the flexibility to iterate without backtracking.
