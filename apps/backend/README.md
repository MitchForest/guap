# Backend

- `convex/core` – auth + config plumbing shared across domains.
- `convex/domains/<feature>` – Convex queries/mutations/services per domain (e.g. `auth`, `moneyMaps`).
- `convex/schema` – Convex table definitions.
- `convex/routes` – HTTP router integration points.

## Commands
- `pnpm --filter @guap/backend generate` – regenerate Convex types.
- `pnpm dev:backend` – run Convex backend in isolation.
