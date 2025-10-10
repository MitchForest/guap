# Guap Platform Plan

## Snapshot – 2025-03-03

### ✅ Recently Completed
- **Workspace Variants**: Convex schema now tracks live/sandbox pairs, helpers copy graphs between variants, and front-end toggles use a typed router map.
- **Routing Canonicalisation**: `src/router.tsx` defines the full route tree and exports `AppPaths`, removing ad-hoc string literals and `as any` casts.
- **Global Tooling**: Root `lint`, `typecheck`, and `build` scripts fan out across every workspace (frontend, backend, providers, api, types). Individual package scripts added where missing.
- **Auth Client Scaffolding**: Better Auth client wrapper typed, Convex token setter centralised in `services/convexClient`.
- **Docs Cleanup**: `.docs` trimmed to canonical references (`convex.md`, `scenarios.md`, `plan.md`) plus the `get-sequence-screenshots/` stub to preserve UX references.
- **Frontend Type Hygiene**: `AppPaths` now exports a trailing-slash-free union, AppShell navigation is typed end-to-end, Better Auth helpers wrap the session/token APIs, and sandbox publishes consume the new `WorkspacePublishResult.edges` map. `pnpm typecheck` is green across the workspace.
- **Provider Queue Instrumentation**: Shared provider package exposes queue telemetry hooks, diff helpers for partial syncs, and Vitest coverage wired into the lint pipeline.
- **Auth Lifecycle Guardrails**: Convex auth tokens clear deterministically on sign-out/error, focus/visibility triggers force Better Auth session refreshes, and hydrate failures now revoke sessions defensively.
- **Sandbox UX Banners**: App shell surfaces draft/stale/pending warnings with responsive banners so status is obvious even outside the canvas view.
- **Auth Provider Decision**: Evaluated the upstream `@convex-dev/better-auth` provider; Solid bindings are not available, so we documented the rationale for staying on the bespoke wrapper (`.docs/auth-provider-decision.md`).
- **Provider Event Audit Log**: Sync actions now capture before/after diffs, duration, and failures into `providerSyncEvents`, and sandbox reset/apply actions land in `workspaceSandboxEvents` for traceability.
- **Provider Smoke Script**: `pnpm smoke:provider` exercises queue telemetry + diff helpers to catch regressions during CI runs.
- **Sandbox Toast & Banner UX**: Solid Sonner provides consistent feedback for sandbox/auth flows, and banners adapt cleanly across breakpoints.
- **Smoke Auth Flow**: `pnpm smoke:auth-workspace` is wired against the live Convex site URL and passes with seeded credentials.

### ⚙️ In Flight
- _None – migration baseline is complete; ready for roadmap planning._

### ⏭️ Next Actions
1. **QA & Handoff**
   - Make the smoke credentials (or generation steps) available and ensure the validation loop (`pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm smoke:auth-workspace`, `pnpm smoke:provider`) stays documented.
2. **Roadmap Planning**
   - Prioritise post-migration work (provider integrations, sandbox approvals, analytics) now that the baseline is stable.

### 🧭 Open Issues / Questions
- **Better Auth typings**: Local wrapper hides the gaps but still relies on a cast; explore upstream contributions or pull in the official convex plugin helpers to remove the `as unknown` escape hatch.
- **Asset Restore**: `get-sequence-screenshots` now contains a README pointing to the design drive. Pull the original PNGs when needed.
- **Provider Telemetry Strategy**: Decide on metric sink (Convex events vs external observability) once the migration stabilises.

## Handoff Notes (for the next engineer)
- Run `pnpm build:shared && pnpm --filter @guap/backend generate` after any Convex schema touch.
- Default validation loop is `pnpm lint`, `pnpm typecheck`, `pnpm build`; all three are passing today.
- Frontend navigation should use `AppPaths.*`; extend `router.tsx` + constants together when adding routes.
- Provider package now exposes queue telemetry and diff helpers—next step is wiring the events into Convex logging and adding the smoke sync script noted above.
- UX sequence screenshots live under `.docs/get-sequence-screenshots/`; populate from the design drive if needed.
