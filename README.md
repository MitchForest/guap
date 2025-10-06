# Guap Monorepo

This workspace houses the front-end Solid.js canvas prototype and the Convex backend.

## Layout

- `apps/frontend` – Solid + Vite application (TanStack Router, Tailwind v4, Solid UI)
- `apps/backend` – Convex backend (to be populated)
- `packages/` – Shared libraries (placeholder for future code)

## Tooling

- Package manager: pnpm (workspace enabled)
- TypeScript base config: `tsconfig.base.json`
- Tailwind CSS v4 via the Vite plugin

## Common Scripts

From the repo root:

```bash
pnpm install          # install all workspace deps
pnpm dev:frontend     # run the Solid app locally
pnpm build:frontend   # production build
```
