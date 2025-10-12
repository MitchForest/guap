# Simplify Identity, Billing, and Money Map Foundations

## Guiding Principles
- Collapse the product around a single account concept: a household with guardians and students managed entirely through Better Auth.
- Remove unused scaffolding (impersonation, secondary variants, speculative billing columns) instead of deprecating it.
- Prefer fresh data structures over migrations when possible; we are allowed to break backward compatibility.
- Keep the codebase lean until school licensing or other enterprise flows are truly required.

## Phase 1 — Identity & Auth Alignment
1. **Prune Better Auth roles**  
   - Update `apps/backend/convex/auth.ts` to configure only `guardian` and `student` roles.  
   - Remove `internal`, `admin`, `member`, and related access-control logic.
2. **Disable impersonation / admin plugin**  
   - Drop the `admin()` plugin registration and any fields or helpers supporting impersonation.  
   - Delete `impersonatedByUserId`, `permissions`, and other unused user attributes and indexes from `schema.ts`, API layer, and frontend contexts.
3. **Adopt Better Auth as sole source of user/org truth**  
   - Remove Convex tables `households`, `householdMemberships`, `organizationMemberships`, `membershipInvites`, and associated mutations/queries.  
   - Replace direct Convex reads/writes with Better Auth organization/member/invite APIs.  
   - Preserve only a lightweight `userProfiles` (or similar) table for household-specific metadata that Better Auth cannot store cleanly; document the minimal schema.

## Phase 2 — Billing Simplification
4. **Integrate Stripe plugin for household subscriptions**  
   - Configure the Stripe plugin and run its migrations.  
   - Create a webhook handler that mirrors only the active plan, renewal date, and payment status into organization metadata.
5. **Remove legacy billing fields**  
   - Delete `subscriptionId`, `customerId`, `seatCapacity`, `seatUsage`, `billingProvider`, and pricing scaffolding from deleted tables.  
   - Eliminate fallback pricing logic in `auth.ts`; defer to Stripe configuration.

## Phase 3 — Household Onboarding & Invites
6. **Streamline invite flows**  
   - Implement two invite paths via Better Auth: guardian-led (guardian invites student) and student-led (student invites guardian).  
   - Provide a neutral “household invite” template that can add both parties sequentially.  
   - Remove any custom Convex invite handlers or email templates no longer required.
7. **Clean up API/client helpers**  
   - Update `@guap/api` and frontend contexts to consume Better Auth outputs directly.  
   - Delete obsolete DTOs, Zod schemas, and generated types tied to removed tables.

## Phase 4 — Money Map Consolidation
8. **Introduce single-map schema**  
   - Create `moneyMaps`, `moneyMapNodes`, `moneyMapEdges`, and `moneyMapRules` tables keyed by household (Better Auth organization id).  
   - Migrate existing workspace data into the new structure; drop `variant`, `pendingRequestId`, `canvasSessions`, `workspaceChangeDiffs`, and sandbox tables/events.  
   - Update backend mutations/queries and frontend state hooks to operate on the new schema.
9. **Guarded change workflow**  
   - Add `moneyMapChangeRequests` recording proposed edits, status (`draft`, `awaiting_guardian`, `approved`, `rejected`), submitter, timestamps, and optional comments.  
   - Require confirmation dialogs on the student UI; only approved requests commit changes to the live map and generate audit entries.

## Phase 5 — Cleanup & Documentation
10. **Codebase sweep**  
    - Remove dead modules (`workspaces.ts`, `sandboxEvents.ts`, etc.) and references from exports.  
    - Run `pnpm lint` / `pnpm typecheck` and fix any fallout.  
    - Add targeted unit tests around new money-map mutations once the testing harness is ready.
11. **Docs & onboarding updates**  
    - Refresh architecture notes in `.docs/convex.md` and onboarding instructions to reflect the new household-only model.  
    - Document how future school licensing would layer on (separate doc outlining license codes, seat allocation, and Stripe coordination).

## Success Criteria
- The only persisted account constructs are Better Auth users and organizations (households) plus the new money map tables.
- Guardians and students can invite each other without any Convex-specific invite tables.
- Billing state lives in Stripe + Better Auth metadata; no stray columns or placeholder enums remain.
- Money map editing works off a single source of truth with a clear approval path.
- Code and docs no longer reference removed tables, plugins, or sandbox flows.
