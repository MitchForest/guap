# Backend / API / Types Refactor Plan

> Frontend feature work is handled by another agent; this plan tracks backend, `@guap/api`, and `@guap/types`.

## Milestones

### Milestone 1 — Establish Folder Scaffolding
- **Status:** ✅ Complete (`pnpm --filter @guap/backend generate`)
- **Highlights**
  - Added `core/`, `domains/`, `schema/`, `routes/` under `apps/backend/convex/`.
  - Moved auth/config/http plumbing into `core` and `routes`.
  - Seeded domain folders and updated the Convex export barrel.

### Milestone 2 — Migrate Money Maps Domain End-to-End
- **Status:** ✅ Complete (`pnpm --filter @guap/backend generate`, `pnpm --filter @guap/api typecheck`)
- **Highlights**
  - Split Money Maps logic into `queries.ts`, `mutations.ts`, `services.ts`.
  - Mirrored domain structure in `packages/api` and `packages/types`.
  - Removed obsolete monolithic files.

### Milestone 3 — Fold Auth/Signup & Shared Contracts
- **Status:** ✅ Complete (`pnpm --filter @guap/backend generate`, `pnpm --filter @guap/api typecheck`, `pnpm --filter @guap/types typecheck`)
- **Highlights**
  - Consolidated auth + signup flows inside `domains/auth`.
  - Better Auth glue and generated assets live under `core/auth/generated/`.
  - Introduced `packages/types/src/shared/` + domain folders (`auth`, `households`, `profiles`, `requests`, `moneyMaps`).
  - Domain clients added to `packages/api/src/domains/auth` alongside money maps.

### Milestone 4 — Finalize Exports & Verification
- **Status:** ✅ Complete
- **Highlights**
  - Synced Convex codegen into `@guap/api/codegen`.
  - Hardened domain clients to use generated schemas for runtime validation.
  - Verified lint/typecheck across backend + packages; frontend build succeeds.
  - Backend `pnpm --filter @guap/backend build` still depends on Convex CLI telemetry (fails offline with Sentry DNS error); reuse existing `_generated` artifacts until run locally.

## Completion Checklist
- [x] Milestone 1 completed.
- [x] Milestone 2 completed.
- [x] Milestone 3 completed.
- [x] Milestone 4 completed.

## Latest Verification
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build:shared`
- `pnpm --filter @guap/frontend build`
- `pnpm --filter @guap/backend generate` *(fails offline with `getaddrinfo ENOTFOUND o1192621.ingest.sentry.io`; existing codegen kept in sync)*
- `pnpm --filter @guap/api typecheck` — API package wiring
- `pnpm --filter @guap/types typecheck` — shared contracts
