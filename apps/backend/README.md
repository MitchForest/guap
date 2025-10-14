# Backend

- `convex/core` – auth + config plumbing shared across domains.
- `convex/domains/<feature>` – Convex queries/mutations/services per domain (e.g. `auth`, `moneyMaps`).
- `convex/schema` – Convex table definitions.
- `convex/routes` – HTTP router integration points.

## Commands
- `pnpm --filter @guap/backend generate` – regenerate Convex types.
- `pnpm dev:backend` – run Convex backend in isolation.

## Provider Sync & Guardrails
- `domains/accounts/syncAccounts` keeps Convex tables, Money Map nodes, and guardrails in lockstep:
  1. Ensures a Money Map exists for the organization, creating a default one if provider data arrives first.
  2. For each provider account, auto-mints a corresponding Money Map account node when one is missing so the canvas reflects reality immediately.
  3. Upserts `financialAccounts`, writes daily `accountSnapshots`, updates category rules derived from the household’s pods, and seeds one account-scoped guardrail (intent `manual`) if it doesn’t exist.
  4. Logs `account_synced` and `guardrail_updated` events so the activity feed mirrors backend changes.
- Guardrails are deduplicated per account to avoid spamming the approvals inbox/activity feed; updates only occur when new policies are required.
