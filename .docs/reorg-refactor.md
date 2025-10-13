# Frontend Reorganization & Debt Elimination Plan

Goal: rebuild `apps/frontend` for radical simplicity, zero technical debt, and full compliance with the agreed conventions. Follow the milestones in order; do not begin a milestone until the previous one is complete and validated. Each milestone includes a definition of done (DoD) and a task checklist to track progress.

---

## Milestone 0 — Baseline Snapshot

**Objective:** capture the current state so we can detect regressions while we refactor.

**DoD**
- Workspace installs cleanly with `pnpm install`.
- We have a local note of outstanding git changes (no blind resets).

**Tasks**
- [ ] Run `pnpm install` to ensure the lockfile is usable.
- [ ] Record current `git status` and stash or commit unrelated work.
- [ ] Note any sandbox constraints or env quirks that could affect later steps.

---

## Milestone 1 — Prune Legacy Artifacts

**Objective:** delete assets that conflict with the “no backwards compatibility” directive so only living code remains.

**DoD**
- Apps/backend smoke scripts, frontend smoke tests, and unused test harnesses are removed.
- Docs are reduced to `apps/frontend/README.md` plus this plan.

**Tasks**
- [ ] Delete smoke-test scripts and configs (e.g. `pnpm smoke:auth-workspace`, associated files in `scripts/` or `apps/backend`).
- [ ] Remove automated tests under `apps/frontend` (e.g. `*.test.ts`, `__tests__/`).
- [ ] Purge extra docs under `.docs/` except `reorg-refactor.md` and required backend auth docs.
- [ ] Update package scripts to drop references to removed commands.

---

## Milestone 2 — Establish Folder Conventions

**Objective:** lay down the canonical folder shape so future moves have a target.

**DoD**
- `apps/frontend/src` contains the top-level pillars only: `app/`, `features/`, `shared/`.
- Each pillar has a README.md describing what belongs inside.

**Tasks**
- [ ] Create `app/` and move bootstrapping files (`index.tsx`, providers, router, contexts, layouts) inside.
- [ ] Create `shared/` with subfolders for `components/`, `services/`, `utils/`, `types/` as needed.
- [ ] Move global stylesheets into `app/styles/` (global CSS entry, design tokens) and update imports.
- [ ] Ensure Solid entry points (`AppProviders`, router) import via the new structure.
- [ ] Add short README.md files in `app/`, `features/`, `shared/` clarifying boundaries.

---

## Milestone 3 — Consolidate Money Map Feature

**Objective:** converge all money map logic into `features/money-map` using the agreed subfolders.

**DoD**
- `features/money-map` exposes a barrel (`index.ts`) re-exporting public APIs (`pages`, `state`, `api`, `components`, `utils`).
- Legacy directories (`components/canvas`, `components/nodes`, `components/create`, `domains/canvas`, `domains/moneyMap`, `utils/simulation.ts`, `types/graph.ts`) are removed.
- `routes` import money map pages via the feature barrel; there are no stray relative imports back into old paths.

**Tasks**
- [ ] Create subfolders (`pages/`, `components/`, `state/`, `api/`, `utils/`, `types/`) within `features/money-map`.
- [ ] Move Canvas page + view-model into `pages/CanvasPage` (view + view-model co-located).
- [ ] Move editor hook, simulation logic, history helpers into `state/` or `utils/` as appropriate.
- [ ] Relocate money map API/cache helpers under `api/`, update imports accordingly.
- [ ] Purge old folders once imports pass `pnpm typecheck`.

---

## Milestone 4 — Normalize Auth & Onboarding

**Objective:** carve out auth, onboarding, and marketing experiences into self-contained features while keeping shared marketing components in `shared/`.

**DoD**
- `features/auth`, `features/onboarding`, and `features/marketing` each own their pages, local components, and loaders/guards.
- `routes/` files for these surfaces become thin loaders delegating to feature entries.
- Feature barrels (`features/auth/index.ts`, etc.) export their page components for router consumption.

**Tasks**
- [ ] Move auth-related pages (sign-in, sign-up, verify, accept invite) into `features/auth/pages/`.
- [ ] Relocate auth-only components (animations, onboarding flows) into `features/auth/components/`; share any marketing visuals through `shared/components/marketing`.
- [ ] Repeat for onboarding flows and marketing pages.
- [ ] Update router imports to use `~/features/...`.

---

## Milestone 5 — Settings & Dashboard Harmonization

**Objective:** finish migrating remaining app surfaces into feature modules and remove dead placeholders.

**DoD**
- Settings, dashboard, and other app tabs live in `features/settings`, `features/dashboard`, etc., with the same folder conventions.
- Placeholder routes are either upgraded to feature stubs inside `features/` or removed entirely if unused.
- `routes/` directory only contains thin re-exporters (or is removed in favor of feature-managed route definitions).

**Tasks**
- [ ] Create feature folders for each surviving route (`dashboard`, `settings`, `tools`, etc.).
- [ ] Co-locate any shared store/context under that feature’s `state/`.
- [ ] Delete empty folders (`data/`, unused `services/`) once code is relocated.
- [ ] Run `pnpm lint` and `pnpm typecheck` to verify imports and styles survive the move.

---

## Milestone 6 — Final Consistency Pass

**Objective:** ensure the codebase reflects the conventions end-to-end and every reference to the old structure is gone.

**DoD**
- All imports use the new module paths; no references to removed folders remain.
- README files and inline comments match the new architecture.
- CI scripts and package.json commands align with the simplified structure.

**Tasks**
- [ ] Search repo for `components/canvas`, `domains/canvas`, `domains/moneyMap`, etc., and confirm zero hits.
- [ ] Update lint/tsconfig path aliases if needed to mirror new folder layout.
- [ ] Trim package scripts and workspace configuration to the minimum set we still use.
- [ ] Document the finished structure in `apps/frontend/README.md`.

---

## Milestone 7 — Verification & Hand-off

**Objective:** validate we have truly removed the debt and the app still boots with the minimal toolchain.

**DoD**
- `pnpm dev` launches the frontend without runtime errors.
- Manual smoke of auth login, Money Map load/save, and settings navigation succeeds.
- Git history shows the entire transition in intentional, reviewable commits.

**Tasks**
- [ ] Run `pnpm dev` and exercise the main flows manually.
- [ ] Capture before/after directory trees for documentation.
- [ ] Prepare a final change log summarizing decisions for future contributors.

---

Stay disciplined: finish each milestone before moving on, keep files large when it improves clarity, and prefer deletion over indirection. No backward compatibility shims—every touchpoint should reflect the new architecture. When in doubt, choose the simplest possible implementation that matches this plan.
