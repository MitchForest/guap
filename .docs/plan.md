# Foundation Plan

## Step-by-Step Tasks
- [x] Retire legacy `GuapApi` household/profile/workspace stubs and shift frontend consumers to Better Auth session data only.
- [x] Refactor `AuthContext` and `AppDataContext` to rely on validated session payloads (no more legacy bootstrapping).
- [x] Publish shared Better Auth session/user schemas and adopt them in the frontend; extend to Convex authorization helpers next.
- [x] Move Money Map graph conversion helpers into `@guap/api` so both client and server share the same runtime validation.
- [x] Simplify the Money Map workflow by removing the “workspace” abstraction from the canvas; front end now edits a single Money Map with drafts + change requests.
- [ ] Define typed Money Map metadata and change-request payload schemas in `@guap/types`, then tighten Convex validators and database writes to match.
- [ ] Enforce one Money Map per organization with supporting Convex indexes and transactional guards around save/delete workflows.
- [ ] Gate Money Map mutations and change-request status updates with domain-specific authorization helpers and validated state transitions.
- [ ] Update automation scripts (`pnpm dev`, codegen sync) and documentation to reflect the refined Money Map workflow.
- [ ] Add smoke-level coverage (or focused tests) around Money Map mutations and auth guards to prevent regressions.

## Milestones
- [ ] **Type-Safe Identity & Provisioning** – Better Auth session parsing everywhere, plus Convex helpers for profiles/memberships.
- [ ] **Money Map Domain Integrity** – Single canonical map per org, validated metadata, and change-request driven publish flow.
- [ ] **Hardened Platform Tooling** – Shared schemas, updated scripts, and regression checks that protect the simplified workflow.

## Upcoming Features
- [ ] Append-only event store with projections powering audit logs and the notifications system.
