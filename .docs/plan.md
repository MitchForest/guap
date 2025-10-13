

## Upcoming Features
- [ ] Append-only event store with projections powering audit logs and the notifications system.

## Auth Integration Alignment
- [x] Use Better Auth’s default organization roles without overrides: first household creator is `owner`, additional guardians are `admin`, and children are `member`.
- [x] Normalize frontend/domain logic to consume `owner`/`admin`/`member` (all legacy guardian/child enums and shims removed).
- [x] Sync Better Auth user roles via hooks (session `after` hook now updates the user record based on membership, keeping owner/admin/member in lockstep).
- [x] Rely exclusively on Better Auth organization endpoints for onboarding (no Convex mutations duplicating invites/membership management).
