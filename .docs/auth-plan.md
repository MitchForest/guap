# Auth & Organization Overhaul Plan

## Objectives
- Replace bespoke Convex auth, organization, invite, and admin logic with Better Auth’s **organization** and **admin** plugins.
- Collapse all role/permission handling into Better Auth access control (including dynamic roles, teams, and invites).
- Eliminate redundant Convex tables (`organizations`, `organizationMemberships`, `membershipInvites`, related helpers) and frontend glue code.
- Deliver a clean slate schema (database reset is acceptable) with zero legacy shims or compatibility layers.

## Snapshot of Current State
- **Backend:** `apps/backend/convex/auth.ts` wires Better Auth core with only `magicLink`, `convex`, `crossDomain` plugins. Organizations, roles, and invites live in Convex tables with custom mutations (`organizations.ts`, `invites.ts`, `membershipHelpers.ts`, etc.). Admin functions are limited to `roleAccessCodes` helpers.
- **Frontend:** `AuthContext`, `RoleContext`, and various routes manage profiles, invitations, and role checks manually via `guapApi`.
- **Shared types:** `packages/types` defines fixed enums (`student`, `guardian`, `admin`, `internal`) that shadow organization membership concepts.
- **API wrapper:** `packages/api` mirrors Convex endpoints, duplicating invite/org operations.

## Migration Strategy
1. **Enable Better Auth plugins**
   - Update `apps/backend/convex/auth.ts` to include `organization()` and `admin()` plugins with required options (teams enabled, dynamic access control, invitation email handler, hooks for custom metadata).
   - Author starter access control statement covering existing resources (organization, member, invitation, team, admin surface).
2. **Database reset & migrations**
   - Drop existing Convex tables tied to organizations/households/role invites.
   - Run `npx @better-auth/cli migrate` (or `generate`) to publish plugin schema.
   - Define additional fields via plugin `schema.additionalFields` for metadata we still need (pricing, billing provider, seat usage, etc.).
3. **Backend rewrite**
   - Remove Convex modules: `organizations.ts`, `invites.ts`, `membershipHelpers.ts`, `roleAccessCodes.ts`, related exports from `index.ts`, and all usages.
   - Replace with thin wrappers calling Better Auth server API where Convex logic is still required (e.g., coupling organizations ↔ households).
   - Rebuild household linkage logic on top of plugin hooks (`afterCreateOrganization`, `afterAddMember`, etc.).
   - Remove custom role enums; align user roles with Better Auth roles or move them to access control definitions.
   - Delete duplicate `dev/convex` copies for deprecated modules.
4. **Frontend client updates**
   - Swap `authClient` configuration to include `organizationClient` and `adminClient` plugins with matching `ac`/`roles`.
   - Refactor `AuthContext` to rely on `authClient.organization.*` APIs (session-driven active org/member; no manual profile bootstrap).
   - Replace `OrganizationRosterPage` and other routes to consume Better Auth data (members list, invites, roles, teams).
   - Remove Session storage hacks (`pendingSignup`, `pendingInvite`) in favor of plugin-provided flows.
5. **Shared package cleanup**
   - Purge organization-related schemas from `packages/types` that are superseded by Better Auth typings.
   - Rebuild `packages/api` wrapper to call Better Auth HTTP endpoints instead of Convex mutations for auth/org/admin operations.
6. **Access control & roles**
   - Define canonical roles (`owner`, `admin`, `member`, plus school-specific roles) with action matrices using `createAccessControl`.
   - Enable dynamic access control for runtime role creation (limit by plan if desired).
   - Set `admin` plugin permissions to align with required operations (impersonation, ban, session management).
7. **Household integration**
   - Model households as organization metadata or separate domain referencing Better Auth IDs.
   - Implement hooks to auto-create household resources upon org creation/member acceptance.
   - Rework household membership logic to key off Better Auth member IDs instead of Convex tables.
8. **Invitations & onboarding**
   - Use plugin invitation endpoints for issuing, resending, acceptance, rejection, cancellation.
   - Implement `sendInvitationEmail` hook to dispatch emails with organization-specific URLs.
   - Remove numeric invite codes; rely on plugin-managed tokens/slugs.
9. **Admin surface**
   - Expose admin client endpoints for staff tooling (user list, ban/unban, impersonation).
   - Build basic SolidJS admin console or integrate into existing settings UI.
10. **Testing & validation**
    - Draft new integration tests (Convex functions) to confirm hooks and household coupling.
    - Add frontend e2e smoke flows covering sign-in, organization creation, invite acceptance, role updates, admin actions.
    - Run `pnpm lint`, `pnpm typecheck`, and targeted smoke tests (`pnpm smoke:auth-workspace`) post-migration.
11. **Deployment checklist**
    - Ensure environment variables for Better Auth invite URLs, admin settings, and email provider are configured.
    - Regression test sign-up/login, cross-domain session handoff, and Graph/Workspace flows.
    - Document manual steps for wiping old tables (Convex dashboard) before deploying.

## Timeline & Sequencing
1. **Week 1:** Enable plugins, craft access control, remove deprecated Convex modules, reset schema.
2. **Week 2:** Frontend/auth client rewrites, rebuild API wrapper, hook up invitations + admin flows.
3. **Week 3:** Household integration via organization hooks, dynamic roles/teams, admin console.
4. **Week 4:** Test hardening, telemetry updates, documentation refresh, final data migration/launch.

## Deliverables
- Updated backend auth configuration with only Better Auth plugins handling organizations/admin.
- Refactored frontend & API packages consuming Better Auth client APIs exclusively.
- Clean Convex schema free of legacy organization/membership tables.
- Documented hooks for households and billing metadata.
- Test suite & smoke scripts reflecting new flows.

## Open Questions
- Billing/seat usage: keep metadata on organization records or external system?
- Admin UX expectations (web UI vs. CLI vs. API-only).
- Email delivery infrastructure for invitations (provider, templates, compliance).

## Sign-off
- Stakeholders acknowledge database reset and breakage of legacy endpoints.
- Engineering commits to no leftover shim code or dual systems.

## Domain Model Agreement
- **Organization types:** Better Auth organizations represent two categories only: `school` (top-level program) and `household` (family unit). A discriminator field is stored on the organization record via `schema.organization.additionalFields`.
- **School roles:** limited to `owner`, `admin`, and `member` (teachers/staff). Schools never hold students directly; instead, they aggregate households for group metrics and discounted pricing. Any household may exist without a school; a school simply coordinates multiple households.
- **Household roles:** `owner` (payer), optional additional `guardian`, and `student`. Students always belong to a household; they gain school access through household membership or direct invite. Guardians attach to specific students (max two per student, excluded from pricing).
- **Pricing (future work):** handled at the organization level via a dedicated pricing table later. Current plan keeps owners solely responsible for billing/deletion actions; admins can manage invites.
- **Membership flows:** Either a student or guardian can initiate a household—whichever joins first invites the other via Better Auth invitations. Schools invite households (or individual guardians/students) when needed, but households can operate entirely standalone. Owners/admins issue invites; guardians approve requests and manage guardrails within their household.

## Current Migration Status

### Completed
- Enabled Better Auth `organization` + `admin` plugins in `apps/backend/convex/auth.ts`, replacing custom Convex tables/helpers with plugin hooks (slug/join-code allocation, household bootstrap, membership sync, invitation lifecycle, role mapping).
- Removed the legacy `dev/` backend clone and unused root-level `convex/_generated` artifacts; `convex codegen` now runs exclusively under `apps/backend`.
- Shared API (`packages/api`) no longer wraps Convex organization/invite mutations—it has been trimmed to households, workspaces, etc.
- Frontend auth flows now speak directly to Better Auth via `authClient.organization.*`:
  * `AuthContext` handles pending admin onboarding (`organization.create`) and accepts stored invites through Better Auth.
  * Invite roster/settings UI fetches members/invitations and manages invites via the plugin.
  * `/auth/accept-invite/:invitationId` route auto-accepts Better Auth invites; manual code entry removed.
  * Signup no longer collects join codes; admins create orgs through Better Auth, others await invites.
- Invite email template now links to `/auth/accept-invite/{invitationId}`.
- Type/lint passes: `pnpm lint`, `pnpm --filter @guap/frontend typecheck`, `pnpm --filter @guap/backend typecheck`.

### Remaining Work
1. **Data Backfill & Cleanup**
   - Script migration for existing invite records to populate `invitationId`/status fields expected by Better Auth (`pending/accepted/rejected/canceled`).
   - Populate new org fields (`type`, `shortCode`, `joinCode`, `billing*`) for legacy records; drop deprecated indices if unused.
   - Document production steps (e.g., re-seeding households, removing old Convex modules once data is ported).
2. **Backend Pruning**
   - Delete unused Convex modules (`apps/backend/convex/organizations.ts`, `invites.ts`, `roleAccessCodes.ts`, and their exports) now that hooks cover the flows.
   - Remove duplicated helper files (`membershipHelpers.ts`) once all references move to the new sync functions.
3. **Frontend Polishing**
   - Ensure settings/onboarding pages reference Better Auth active organization/member state (e.g., show active role via `authClient.organization.getActiveMemberRole`).
   - Add UI affordances for resending invites or listing guardian/student households if required.
4. **Pricing & Admin UI (Future Work)**
   - Integrate upcoming pricing table with Better Auth org metadata.
   - Build admin console on top of `authClient.admin.*` endpoints as needed.

### Handoff Notes
- All codegen and Convex scripts run from `apps/backend`; use `pnpm --filter @guap/backend generate` followed by `pnpm run sync-convex-codegen` if you update the schema.
- Organization invites should now flow through the Better Auth plugin; do **not** resurrect legacy `guapApi.createOrganizationInvite` / join-code logic.
- When removing legacy Convex modules, update `apps/backend/convex/index.ts` exports and rerun typecheck before deleting the files.
- Keep `pendingInvite` storage keyed by Better Auth `invitationId`; invite emails are responsible for supplying that ID.
- Verify any analytics/telemetry still hooked into invite acceptance or org creation paths after the refactor.
- **Membership flows:** Either a student or guardian can initiate a household—whichever joins first invites the other via Better Auth invitations. Households can later be invited to a school; depending on the plan, either the guardian pays or the school covers fees.
- **Independence:** Households may operate entirely standalone (no school association). Schools link to households only through organization memberships; no hard dependency in the data model.
