## Shared Surface

- Cross-feature UI primitives (`components/ui`), services, and utilities.
- Keep modules generic; they must not reference feature-specific state or routing.
- Shared services (like Convex, Better Auth, telemetry) live here for reuse across pods.
- Prefer small focused helpers; if something grows feature knowledge, move it back into that feature.
