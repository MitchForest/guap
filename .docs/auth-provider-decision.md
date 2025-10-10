# Auth Provider Strategy Decision

**Date:** 2025-03-03  
**Context:** Better Auth integration for the SolidJS frontend + Convex backend.

## Options Considered

1. **Adopt `ConvexBetterAuthProvider` from `@convex-dev/better-auth`**
   - Pros: ships with session/token helpers wired to Convex, no custom hydration needed.
   - Cons: current package only exposes React bindings; no Solid-compatible provider is published. Adopting it would force a React interop layer or a fork.

2. **Maintain the bespoke Solid wrapper (current approach)**
   - Pros: Already battle-tested in the app, minimal surface area, integrates directly with Solid contexts.
   - Cons: Requires keeping the token fetcher + session refresh in sync with Better Auth changes; upgrades demand manual validation.

## Decision

Stay with the bespoke Solid wrapper for now. The lack of a Solid-compatible `ConvexBetterAuthProvider` means an official drop-in replacement does not exist. The wrapper now handles token refresh, focus/visibility hydration, and defensive sign-out on errors, closing the reliability gaps highlighted in the plan.

## Follow-Up

- Track the `@convex-dev/better-auth` roadmap; if a Solid provider ships upstream, revisit this decision.
- Keep the wrapper API narrow and well-tested so swapping implementations later is low risk.
- Document the refresh/clear semantics in `apps/frontend/src/contexts/AuthContext.tsx` to ease future migrations (done in the code comments accompanying the latest changes).
