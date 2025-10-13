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

- **Runtime topology**: `pnpm dev` starts `convex dev`, which hot-syncs code from `apps/backend/convex` into the remote dev deployment (`dev:original-platypus-829`) while Solid runs locally on `http://localhost:3001`. The frontend always talks to that hosted Convex deployment, even during local development.
- **Better Auth surface**: Backend routes register Better Auth’s HTTP handlers (magic links, sessions, invitations); the Solid client uses `better-auth/solid` with Convex plugins to mint and cache tokens automatically.
- **Environment sources**: Any key needed by Convex in the cloud must be set with `npx convex env set`. Local `.env.local` mirrors those values for Solid and CLI tooling; Convex-managed keys like `CONVEX_SITE_URL` are built-in and cannot be overridden.
- **Going fully local**: If you need an offline sandbox, run `CONVEX_DEPLOYMENT=` (or `convex dev --local`) to spin up an in-memory deployment; update `VITE_CONVEX_URL` / `VITE_CONVEX_SITE_URL` temporarily so the frontend points at the local instance.

- **Type Safety**: All cross-layer data must flow through `@guap/types` schemas. Convex schema enums derive from these arrays; frontend contexts import the same enums/types.
- **API Access**: Frontend never calls `convex.query` directly; it uses `@guap/api` wrappers with runtime validation.
- **Workspace Variants**: Convex tracks `{ householdId, variant: 'live' | 'sandbox' }`; frontend toggles via `AppPaths.app` vs sandbox state. All publish/reset/apply flows go through new mutations.
- **Routing**: `src/app/router.tsx` defines the full tree and exports `AppPaths` + `AppRoutePath`. Navigation must use these constants (no string literals).
- **Context Composition**: `src/app/AppProviders.tsx` wires Role → Auth → AppData → Shell. Reuse this wrapper for tests/stories to keep provider order consistent.
- **Providers**: All external banking/brokerage syncs go through `packages/providers`. Backend provider module only interacts via the registry/queue exports.

### Directory Boundaries

| Path | Responsibility | Key Dependencies |
| ---- | -------------- | ---------------- |
| `apps/frontend` | SolidJS UI organized into `app/`, `features/`, `shared/` | SolidJS, TanStack Router, Tailwind v4, `@guap/api`, `@guap/types`, Better Auth client |
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
- Router updates require adding to `app/router.tsx` and updating `app/routerPaths.ts`.

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

Each workspace also exposes package-specific scripts:

- `apps/frontend`: `pnpm run lint` (ESLint), `pnpm run typecheck` (TSC), `pnpm run build` (Vite).
- `apps/backend`: `pnpm run generate` (Convex codegen), `pnpm run typecheck` (`tsc --noEmit`), `pnpm run build` (alias to codegen).
- `packages/{types,api,providers}`: `pnpm run build`, `pnpm run typecheck`.

### Toolchain
- **Package manager**: pnpm (see `pnpm-workspace.yaml`).
- **TypeScript**: strict mode, base config in `tsconfig.base.json`.
- **Styling & UI**: Tailwind CSS v4 via `@tailwindcss/vite`; reusable primitives built on Kobalte + class-variance-authority with Solid Sonner for notifications.
- **Testing**: Lint/typecheck across all packages plus targeted Vitest suites (`packages/providers`).

### Email (Resend)

Better Auth sends transactional email through [Resend](https://resend.com). Configure these environment variables for production and local development:

- `RESEND_API_KEY` – default API key (used when no override is provided).
- `MAGIC_LINK_FROM_EMAIL` – from-address for magic links (e.g. `Guap <no-reply@guap.app>`).
- `MAGIC_LINK_RESEND_API_KEY` – optional override for magic link emails (falls back to `RESEND_API_KEY`).

When no API key is present the backend simply logs the payload, which keeps local development friction-free.

## Canonical Docs
- `.docs/reorg-refactor.md` – active plan for the frontend reorganization.

## Handoff Quickstart
1. `pnpm install`
2. `pnpm build:shared && pnpm --filter @guap/backend generate`
3. `pnpm lint` (ensure workspace is clean)
4. `pnpm typecheck`

Keep router definitions, shared types, and provider abstractions in sync to maintain type safety across the stack.
