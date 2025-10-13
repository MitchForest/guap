## Feature Pods

- One folder per feature (`auth`, `money-map`, `settings`, etc.).
- Each pod may expose `pages/`, `components/`, `state/`, `api/`, `utils/`, and optional `types/`.
- Routes import via the feature barrel (`index.ts`) instead of deep relative paths.
- Feature-specific state stays inside the feature; promote to `shared/` only when reused by multiple pods.
