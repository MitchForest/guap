# Guap Monorepo

A pnpm workspace housing the Guap platform:

- **apps/frontend** – SolidJS client (TanStack Router, Tailwind v4, Kobalte primitives, Solid Sonner) that renders the Money Map canvas, auth flows, and responsive shell.
- **apps/backend** – Convex backend (Better Auth integration, schema/mutations for households, workspaces, requests, providers).
- **packages/types** – Shared Zod schemas + enums that define the canonical data contracts for frontend and backend.
- **packages/api** – Typed Convex client wrappers used by the frontend (runtime validation, consistent error handling).
- **packages/providers** – Provider abstraction layer (rate-limiters, registry, virtual provider, future banking/brokerage adapters).
- **.docs** – Developer notes (architecture, scenarios, canonical plan, UX screenshot placeholders).

## Architecture & Conventions

### High-Level Flow
```
Solid Router (apps/frontend) ─┐
  │  ↳ AuthContext → Better Auth client → Convex token setter
  │  ↳ AppDataProvider → @guap/api (Convex client wrappers)
  │  ↳ Workspace domain → publish/list via @guap/api → Convex mutations
  │
Convex (apps/backend) ────────┤
  │  ↳ Better Auth component (convex/auth.ts)
  │  ↳ Domain modules (workspaces, graph, requests, providers, households, users)
  │  ↳ Provider queue/scheduler integrates packages/providers
  │
Shared Packages ──────────────┘
```

- **Type Safety**: All cross-layer data must flow through `@guap/types` schemas. Convex schema enums derive from these arrays; frontend contexts import the same enums/types.
- **API Access**: Frontend never calls `convex.query` directly; it uses `@guap/api` wrappers with runtime validation.
- **Workspace Variants**: Convex tracks `{ householdId, variant: 'live' | 'sandbox' }`; frontend toggles via `AppPaths.app` vs sandbox state. All publish/reset/apply flows go through new mutations.
- **Routing**: `src/router.tsx` defines the full tree and exports `AppPaths` + `AppRoutePath`. Navigation must use these constants (no string literals).
- **Context Composition**: `src/AppProviders.tsx` wires Role → Auth → AppData → Shell. Reuse this wrapper for tests/stories to keep provider order consistent.
- **Providers**: All external banking/brokerage syncs go through `packages/providers`. Backend provider module only interacts via the registry/queue exports.

### Directory Boundaries

| Path | Responsibility | Key Dependencies |
| ---- | -------------- | ---------------- |
| `apps/frontend` | SolidJS UI, contexts, router, Money Map canvas, auth flows | SolidJS, TanStack Router, Tailwind v4, `@guap/api`, `@guap/types`, Better Auth client |
| `apps/backend` | Convex schemas/functions, Better Auth server integration, provider queue | Convex, Better Auth (`@convex-dev/better-auth`), `@guap/types`, `packages/providers` |
| `packages/types` | Zod schemas/enums, shared TypeScript types | Zod |
| `packages/api` | Convex client wrapper with validation | Convex browser client, `@guap/types`, Zod |
| `packages/providers` | Provider contracts & virtual adapter | `@guap/types`, `@tanstack/pacer`, Zod |
| `.docs` | Architecture references (`convex.md`, `scenarios.md`), `plan.md`, UX screenshot readme | n/a |

### Coding Conventions
- TypeScript strict mode (see `tsconfig.base.json`).
- Use `~/` aliases for frontend imports (configured via `tsconfig` + Vite).
- Use `@guap/types` enums instead of duplicating literals.
- Convex modules: keep per-domain files (`convex/workspaces.ts`, `convex/graph.ts`, etc.).
- Provider integrations must go through `packages/providers` exports (no direct provider-specific code in frontend/backend).
- Router updates require adding to `router.tsx` and updating `AppPaths`.

## Scripts & Tooling

Run from the repo root:

| Script | Description |
| ------ | ----------- |
| `pnpm install` | Install dependencies across all workspaces. |
| `pnpm dev:frontend` | Start Solid app in dev mode (`apps/frontend`). |
| `pnpm dev:backend` | Run Convex dev server (`apps/backend`). |
| `pnpm dev` | Run backend + frontend concurrently. |
| `pnpm build:shared` | Build shared packages (`types`, `api`, `providers`). |
| `pnpm build` | Build shared packages, backend (codegen), and frontend. |
| `pnpm lint` | Run lint/type-check on every package/app (commands delegated via workspace scripts). |
| `pnpm typecheck` | Run `tsc --noEmit` for every package/app. |
| `pnpm --filter @guap/backend generate` | Run Convex codegen (after schema changes). |
| `pnpm smoke:auth-workspace` | Smoke test auth + workspace publish flow via Convex HTTP client (`.env.local` required). |
| `pnpm smoke:provider` | Smoke test provider queue/diff helpers using the virtual adapter. |

Each workspace also exposes package-specific scripts:

- `apps/frontend`: `pnpm run lint` (ESLint), `pnpm run typecheck` (TSC), `pnpm run build` (Vite).
- `apps/backend`: `pnpm run generate` (Convex codegen), `pnpm run typecheck` (`tsc --noEmit`), `pnpm run build` (alias to codegen).
- `packages/{types,api,providers}`: `pnpm run build`, `pnpm run typecheck`.

### Toolchain
- **Package manager**: pnpm (see `pnpm-workspace.yaml`).
- **TypeScript**: strict mode, base config in `tsconfig.base.json`.
- **Styling & UI**: Tailwind CSS v4 via `@tailwindcss/vite`; reusable primitives built on Kobalte + class-variance-authority with Solid Sonner for notifications.
- **Testing**: Lint/typecheck across all packages plus targeted Vitest suites (`packages/providers`). Smoke scripts cover auth + provider pipelines.

### Smoke Test Setup
Create `.env.local` in the repo root (ignored by git) with credentials for the hosted Convex deployment:
```
SMOKE_AUTH_URL=https://<your-convex-deployment>.convex.site
SMOKE_CONVEX_URL=https://<your-convex-deployment>.convex.cloud
SMOKE_EMAIL=<smoke-user@your-domain>
SMOKE_PASSWORD=<min-8-char-password>
SMOKE_NAME=<Display Name>
```
Then run:
```
pnpm smoke:auth-workspace
pnpm smoke:provider
```
Both commands should complete without errors before shipping.

## Canonical Docs
- `.docs/plan.md` – current state, active work, handoff notes.
- `.docs/convex.md` – Convex architecture reference.
- `.docs/scenarios.md` – Product/UX scenarios.
- `.docs/get-sequence-screenshots/README.md` – pointer to UX assets (restore PNGs from design drive when needed).

## Handoff Quickstart
1. `pnpm install`
2. `pnpm build:shared && pnpm --filter @guap/backend generate`
3. `pnpm lint` (ensure workspace is clean)
4. `pnpm typecheck` (known issues documented in `.docs/plan.md`)
5. Read `.docs/plan.md` for current focus and TODOs.

Keep router definitions, shared types, and provider abstractions in sync to maintain type safety across the stack.
