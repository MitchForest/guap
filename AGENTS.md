# Overview
Guap is a pnpm workspace with two apps (frontend, backend) plus shared packages (`api`, `providers`, `types`). Everything should stay radically simple: one obvious home per concern, no legacy shims, no dead files.

# Commands
- `pnpm install` – install workspace dependencies.
- `pnpm dev` – run Convex and Solid together (preferred dev flow).
- `pnpm dev:frontend` / `pnpm dev:backend` – focus on a single surface.
- `pnpm --filter @guap/backend generate` – regenerate Convex types after schema edits.
- `pnpm build` – rebuild shared packages, run Convex codegen, compile frontend.
- `pnpm lint` / `pnpm typecheck` – enforce linting and strict types.

# Runtime Topology
- `pnpm dev` launches `convex dev`, which hot-syncs backend code to the hosted dev deployment (`dev:original-platypus-829`) while Solid runs locally on `http://localhost:3001`; the frontend always calls that remote Convex URL.
- Better Auth HTTP routes are registered inside Convex; the Solid client uses `better-auth/solid` + Convex plugins to fetch session data and Convex auth tokens automatically.
- Cloud env vars live in Convex via `npx convex env set`; `.env.local` mirrors the same values for local tooling. Built-in keys like `CONVEX_SITE_URL` come from Convex and cannot be overridden.
- To work fully offline, start Convex with `convex dev --local` (or clear `CONVEX_DEPLOYMENT`) and point `VITE_CONVEX_URL` / `VITE_CONVEX_SITE_URL` at the local URL temporarily.

# apps/frontend
- `app/` contains bootstrapping: entry (`index.tsx`), providers, router, and global styles.
- `features/` houses feature pods—each should expose `pages/`, `components/`, `state/`, `api/`, `utils/`, optional `types/`. `legacy/` is temporary until refactors land.
- `shared/` keeps cross-feature UI, services, utilities, and shared types.
- Always wrap Solid entry points with `AppProviders` to align auth/app data/shell contexts.

# apps/backend
- Convex code follows `core/`, `domains/`, `schema/`, `routes/`.
- `core/` holds auth, config, shared utils; generated Better Auth artifacts live under `core/auth/generated/`.
- `domains/<feature>/` keeps queries, mutations, and services for that business area (prefer one organized file over scattered helpers).
- `schema/` encapsulates Convex table definitions; `_generated/` remains codegen-only.
- Root `index.ts` re-exports domain barrels; no stray files under `convex/`.

# packages/api
- `core/` provides Convex client factory and root types.
- `domains/<feature>/` groups each API surface (`client.ts`, optional `transformers.ts`) mirroring backend domains.
- Package `index.ts` composes domain clients into `createGuapApi`; exports remain tree-shakeable.

# packages/types
- `shared/` holds enums/primitives reused across domains.
- `domains/<feature>/` owns Zod schemas + inferred types for that feature; each has a small `index.ts`.
- Generated files stay in `generated/` and are imported by domain modules as needed.
- Top-level `index.ts` re-exports domain and shared modules—no monolithic schema dump.

# packages/providers
- Houses integration helpers for external providers; follow the same “one folder per provider” convention when expanded.

---- DON'T DELETE BELOW THIS LINE (authored by user)----

RULES:
- Auth Schema Updates (local install): cd apps/backend/convex/betterAuth, npx @better-auth/cli generate -y, pnpm sync:codegen, npx convex dev --once
- In 99.9% of the time, use Better Auth defaults (tables, schemas, apis, hooks, naming conventions, orgs/users/roles/permissions, etc). There must be a very good reason to stray from this and explicit user approval. We use better auth names but internally our mapping is as follows. Org = Household. Owner = first to signup for a new org. Admin = othe parents/guardians invite in. Members = students.
- Get user explicit approval before any database/schema changes
- Use kobalte, tailwind, class variance authority for components
- Follow established conventions/patterns for code organization (one long file is better than arbitraily splitting a file into a bunch of helpers that are hard to reason about; but even better than that is having a clean split per domain between view, view model, actions, and state if necessary)
- ZERO backwards-compatibility, legacy shims, etc. This is another phrase for LAZY code and technical debt and we have ZERO tolerance for it.
- Do not edit .env variables (or expected variables) without user explicit approval (and if backend ones are edited, use npx convex env set VAR_NAME value)
- Follow established conventions/patterns for code organization (one long file is better than arbitraily splitting a file into a bunch of helpers that are hard to reason about; but even better than that is having a clean split per domain between view, view model, actions, and state if necessary)


PRINCIPLES:
- Simplicity First, Always
We optimize for clarity, not cleverness. The best system is the simplest one that accomplishes the goal cleanly.

- Question complexity, don’t perpetuate it.
When you see technical debt, awkward abstractions, or tangled logic, pause before adding more. Ask: “Is this the simplest way to achieve the goal?”

- Favor deletion over addition.
If a feature, abstraction, or layer can be removed without breaking the product’s promise — remove it. Every extra piece of code is a maintenance cost.

- Resist “cargo cult” engineering.
Don’t copy patterns or introduce frameworks without understanding why they’re needed. Build from first principles and adapt to our actual use case.

- Prefer explicitness to cleverness.
Code should be easy to reason about for any future reader. If something requires multiple mental hops to follow, it’s too complex.

- Spot and call out over-engineering.
It’s everyone’s job to raise a hand when something feels more complicated than it needs to be — even if it “works.” Silent acceptance is how technical debt spirals.

- Conventions over invention.
Follow established patterns and architecture guidelines unless there’s a clear, articulated reason to deviate. Shared conventions reduce friction and cognitive load.

- Mental models over magic.
Each module should have a simple conceptual model (“this thing does one job”). If it’s hard to explain, it’s probably hard to maintain.
