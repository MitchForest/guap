# Foundation Plan – Better Auth, Money Map, and Providers

## Guiding Principles
- Better Auth is the single source of truth for identity, RBAC, households, invites, and billing metadata. We map guardians ⇔ admins and children ⇔ members; households are Better Auth organizations.
- The frontend never talks to Convex directly. All mutations/queries flow through `@guap/api`, which wraps runtime validation against `@guap/types`.
- Shared contracts live in `@guap/types` and are consumed everywhere (Convex schema, API client, providers, UI). We only define guardian/child roles.
- Keep the providers package as a thin abstraction that can return virtual accounts today and swap in real banking adapters later without changing callers.
- Optimize for a clean baseline first; UI refinements and additional features come after the foundation is solid.

## Phase 1 — Restore Shared Contracts & Client Surface
1. **Rebuild `@guap/types`**  
   - Reintroduce enums/schemas for guardian/child roles, households, memberships, money map records, currency amounts, income cadence, etc.  
   - Export type aliases for all frontend/backend/provider consumers.
2. **Flesh out `@guap/api`**  
   - Implement the full Convex client surface the frontend relies on (households, profiles, invites, money map CRUD, approvals).  
   - Validate all inputs/outputs with the rebuilt schemas and remove placeholder method stubs.

## Phase 2 — Backend Hardening Around Better Auth
3. **Guard every Convex handler**  
   - Create shared helpers that call `requireAuth`, load the Better Auth organization/member, and enforce that requested `organizationId`/`mapId`/`childId` belong to the session.  
   - Apply the guard to all money map queries/mutations; reject cross-tenant access.
4. **Enforce one money map per child**  
   - Key the schema by child profile ID (Better Auth member) and guarantee uniqueness.  
   - Ensure change requests reference that map and only guardians in the same household can approve.  
   - Normalize “sandbox” behavior into draft/change-request flows rather than duplicate maps.

## Phase 3 — Frontend Alignment
5. **Refactor contexts to Better Auth data**  
   - Load guardian/child state from Better Auth session data instead of legacy helpers.  
   - Replace direct Convex references with `@guap/api` calls and drop obsolete compatibility layers.
6. **Reconnect money map UI to new workflow**  
   - Update the student experience to draft changes, run simulations, and submit approvals via the guarded mutations.  
   - Ensure guardian review/approval uses the same API client and reflects live map updates.

## Phase 4 — Providers Abstraction
7. **Clarify provider contracts**  
   - Keep `@guap/providers` focused on adapter interfaces, DTO schemas, and the virtual provider implementation.  
   - Route the backend through this abstraction so switching to real banking adapters is a configuration change.
8. **Persist sync data consistently**  
   - Store provider sync results in Convex tables keyed by provider + household using the shared schemas, ready for real-money integrations later.

## Phase 5 — Billing & Stripe (Stub-Friendly)
9. **Stabilize Stripe plugin usage**  
   - Maintain placeholder keys for local dev but ensure the plugin path is wired so production credentials are a drop-in.  
   - Mirror subscription state into Better Auth org metadata only when real keys are supplied.

## Phase 6 — Verification & Documentation
10. **Validation sweep**  
    - Run `pnpm lint`, `pnpm typecheck`, and targeted smoke tests once the above phases land.  
    - Add minimal unit coverage around money map mutations when the test harness is ready.
11. **Update docs & onboarding**  
    - Refresh `.docs/convex.md` with the guardian/child household model and the new money map lifecycle.  
    - Document the provider abstraction and future real-money upgrade path.  
    - Note that UI feature work resumes only after this baseline is complete.

## Success Criteria
- Only Better Auth defines users, households, invites, and roles (guardian/child); Convex stores references, not parallel data models.
- `@guap/types` and `@guap/api` provide the single contract for all mutations/queries; frontend code depends on them exclusively.
- Money maps exist as one canonical record per child with a clear draft → approval → live workflow and enforced tenant boundaries.
- Providers remain swappable, with virtual accounts serving free plans and real adapters ready for paid upgrades.
- Billing integration is Stripe-first but safely stubbed until credentials arrive.
- Docs and code reflect this baseline, enabling future feature work without re-litigating foundational pieces.
