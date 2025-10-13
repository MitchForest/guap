# @guap/types

- `src/shared` – cross-domain enums and primitives.
- `src/domains/<feature>` – Zod schemas and inferred types grouped by feature (auth, households, profiles, requests, moneyMaps).
- `dist` – build artifacts (generated).

## Commands
- `pnpm --filter @guap/types typecheck` – validate domain contracts.
- `pnpm --filter @guap/types build` – emit compiled type bundle.
