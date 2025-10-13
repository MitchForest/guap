

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
