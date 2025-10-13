# Frontend (SolidJS)

Solid application structured for clarity-first feature pods.

## Getting Started

```bash
pnpm install
pnpm dev           # launches Vite dev server
pnpm lint          # eslint solid/typescript rules
pnpm typecheck     # tsc --noEmit
pnpm build         # production build
```

The combined workspace `pnpm dev` script (from the repo root) runs Convex + this client together.

## Directory Layout (`src/`)

| Path | Description |
| --- | --- |
| `app/` | Bootstrapping: entry (`index.tsx`), router, providers, global styles (`styles/`). |
| `features/` | One folder per feature (e.g. `auth`, `money-map`, `marketing`). Each pod uses `pages/`, `components/`, `state/`, `api/`, `utils/`, and optional `types/`. |
| `shared/` | Cross-feature primitives (UI components, services, helpers shared by multiple features). |

Feature pages are the router entry points. Views co-locate with their view-model or state hook; prefer a single descriptive file over scattering helpers.

## Conventions

- Absolute imports use `~/*` (see `tsconfig.json`).
- Wrap the app with `app/AppProviders.tsx` to ensure Auth/AppData/Shell contexts stay in sync.
- Favor deletion over indirection: if logic is feature-specific, keep it inside that feature pod.
- Components under `shared/components/ui` are the only globally reusable UI primitives; anything feature-specific lives inside that feature.

## Verification Flow

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm build`

Run these before shipping to ensure lint + type safety + build integrity.
