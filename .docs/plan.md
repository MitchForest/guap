

## Upcoming Features
- [ ] Append-only event store with projections powering audit logs and the notifications system.

## Better Auth Alignment
- [x] Replace the bespoke Convex auth factory with a bare Better Auth instance (plugins configured declaratively, no manual role syncing or extra fields).
- [x] Drop the legacy `roleSyncHook` + `authorization.ts`; fetch organization + roles directly from the Better Auth session payload.
- [x] Adopt generated Better Auth role values (`BetterAuthRoleValues`) so shared schemas and helpers always reference the Better Auth source of truth.
- [x] Move organization bootstrap to the backend (`convex/signup.ts`) and delete the client-side pending signup shim.
- [x] Trim the invite acceptance helpers from `AuthContext` and process invites through Convex `signup.bootstrap` so the frontend no longer keeps local storage state.
- [x] Retire the RoleContext/localStorage cache; derive role/permissions straight from the session in `AuthContext`.
- [x] Remove the bespoke smoke magic-link HTTP endpoint; smoke harness now reads verification rows through Convex.
- [x] Use the Better Auth client helpers for session refresh + Convex JWT exchange (no more bespoke fetchers).

## Radical Simplicity Cleanup
- [ ] Remove `apps/frontend/src/domains/workspaces` and route all Money Map interactions through `domains/moneyMap`.
- [ ] Trim `packages/api/src/workspaces` to Money Map helpers only and delete workspace-specific exports that lost callers.
- [ ] Delete workspace schemas/types from `packages/types` so shared contracts mirror the Convex schema.
- [ ] Pare `packages/providers` back to the core contracts plus the virtual provider; drop registry/diff/limiter scaffolding until real banking adapters arrive.
- [ ] Replace the fabricated household data in `AppDataContext` with real Convex queries (or remove the context until the data exists) so consumers never read mock state.
- [ ] Split `CanvasPage` into a thin page shell, a headless editor controller, and presentational components for the surface, toolbar, and drawers.
- [ ] Break `NodeDrawer` into smaller components (form, allocations, metadata) backed by a shared drawer-state hook.
- [ ] Re-audit frontend and backend auth flows to ensure orgs, invites, roles, permissions, sessions, JWTs, OTT, and magic links all route exclusively through Better Auth clients/hooks.
- [ ] Delete any remaining pending-signup or invite-local-storage helpers once Better Auth server hooks cover onboarding end to end.
- [ ] Confirm invite creation/delivery flows call the shared Resend helper and remove any alternate email pipelines.
- [ ] Simplify the smoke harness to rely solely on Better Auth client APIs, removing bespoke request helpers once the primary flows are in place.
- [ ] Break complex features (e.g., Money Map editor) into a co-located `state/actions/view-model/view` set to enforce clear separation without scattering files. Keep simpler screens as single modules.
