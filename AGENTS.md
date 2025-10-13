# Repository Guidelines

## Project Structure & Module Organization
This pnpm workspace houses two apps and three shared packages. `apps/frontend` is the SolidJS client; domain views live under `routes/` and shared UI under `components/`, while router state is centralized in `router.tsx`. `apps/backend` contains Convex functions grouped per domain inside `convex/` (schema, auth, providers, workspaces, etc.). Shared logic resides in `packages/types` (Zod contracts), `packages/api` (Convex client wrappers), and `packages/providers` (integration layer). Keep cross-cutting docs in `.docs/` and helper automation in `scripts/`.

## Build, Test, and Development Commands
- `pnpm install` – install workspace dependencies and hoist shared toolchains.
- `pnpm dev` – run Convex and the Solid app together for end-to-end flows.
- `pnpm dev:frontend` / `pnpm dev:backend` – focus on a single surface when debugging.
- `pnpm --filter @guap/backend generate` – regenerate Convex types after schema edits.
- `pnpm build` – rebuild shared packages, run Convex codegen, then compile the frontend.
- `pnpm lint` / `pnpm typecheck` – enforce ESLint rules and strict `tsc --noEmit`.
- `pnpm smoke:auth-workspace` – exercise the auth + workspace publish path via HTTP.
- **Do not run** `pnpm --filter @guap/backend dev`. Convex dev is already managed by the shared `pnpm dev` flow, and running the backend target directly will fail on schema validation (existing data lacks optional fields) and wastes time. If you need to regenerate backend artefacts, use `pnpm --filter @guap/backend generate` instead.

## Coding Style & Naming Conventions
Use TypeScript strict mode from `tsconfig.base.json` and prefer named exports per module. Default to two-space indentation and keep Solid components in PascalCase (`MoneyMapCanvas`). Reference shared enums and schemas from `@guap/types` rather than re-declaring literals. Frontend routes must use the `AppPaths` helpers from `router.tsx`, and backend Convex modules should stay domain-scoped (`convex/workspaces.ts`, `convex/providers.ts`). Solid entry points should wrap children with `AppProviders` so Role/Auth/AppData/Shell contexts remain in sync. ESLint (see `apps/frontend/eslint.config.js`) enforces Solid and TypeScript rules; prefix intentionally unused variables with `_` to satisfy the configured `no-unused-vars` warning.

## Testing Guidelines
Automated testing is still being bootstrapped, so linting, type-checking, and the smoke script act as the current guardrails. When introducing unit tests, colocate them with the feature under `__tests__/` or `*.test.ts` files and run them through the workspace that owns the code (e.g., add a `vitest` script inside `apps/frontend`). For backend changes, validate mutations and queries against `convex dev` before opening a pull request.

## Commit & Pull Request Guidelines
Follow the existing git history: concise, present-tense commit subjects (`add sandbox toggle`, `fix type/lint errors`). Each commit should describe a single logical change and include updated Convex codegen artifacts when necessary. Pull requests should outline the intent, link to any tracking issue, list verification commands (`pnpm lint`, `pnpm dev` smoke checks), and attach screenshots or recordings when UI changes are involved. Highlight any schema or provider-contract changes so reviewers can audit downstream impact.

## Reference Docs & Environment
Before larger work, review `.docs/plan.md` for current priorities and `.docs/convex.md` for architecture notes. Keep Convex secrets out of the repo; use `convex env set` or project-bound secrets. When switching contexts (sandbox vs live workspace), ensure both backend mutations and frontend router paths stay aligned to avoid leaking data between variants.

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