# @guap/api

- `src/core` – Convex client factory and shared types.
- `src/domains/<feature>` – Typed clients and helpers per backend domain (e.g. `moneyMaps`, `auth`).
- `codegen` – Generated Convex API bindings (do not edit).

## Commands
- `pnpm --filter @guap/api typecheck` – ensure API wrappers stay in sync with backend schema.
- `pnpm --filter @guap/api build` – emit compiled API bundle.
