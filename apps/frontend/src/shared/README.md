## Shared Surface

- Cross-feature UI primitives (`components/ui`), services, and utilities.
- Keep modules generic; they must not reference feature-specific state or routing.
- Shared services (like Convex, Better Auth, telemetry) live here for reuse across pods.
- Prefer small focused helpers; if something grows feature knowledge, move it back into that feature.
- `components/data` and `components/skeletons` expose loading and placeholder building blocks (`DataState`, `PageSkeleton`, `TableSkeleton`, `StatSkeleton`).
- `components/data-table` provides a lightweight table shell with search/filter hooks ready for feature wiring.
- `components/layout` centralises page containers, sections, metric cards, modals, drawers, and sticky CTA wrappers.
- `forms` wraps TanStack Form with a `createGuapForm` helper plus standard `FormField`/`FormActions` primitives.
- `services/notifications`, `services/errors`, and `services/analytics` unify toast delivery, error reporting, and event tracking.
- `services/queryHelpers` exposes `createGuapQuery` for Solid resources backed by Convex/Guap API calls.
- `utils/permissions` exposes `usePermission` and `PermissionGate` for role-aware rendering.
