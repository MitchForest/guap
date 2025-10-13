# @guap/providers

- `src/contracts.ts` — shared provider interfaces and rate limiter contracts.
- `src/virtual.ts` — in-memory provider used for development/demo flows.
- `src/index.ts` — barrel export; extend here when new providers ship.

## Commands
- `pnpm --filter @guap/providers typecheck`
- `pnpm --filter @guap/providers build`
