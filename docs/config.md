# Config

Phase-1 config should be environment-driven.

Expected config areas:

- auth-ui public base URL
- auth-server base URL
- any route-level public configuration needed for browser redirects

Current local defaults:

- auth-ui: `http://localhost:3005`
- auth-server: `http://localhost:8050`

Rules:

- no provider secrets in the UI
- no token signing config in the UI
- keep the UI configuration focused on rendering and API integration only
- validate browser-facing base URLs at startup
- fail fast if `VITE_APP_NAME` is empty

Deployment baseline:

- `bun run check` should pass before release
- `bun run preview` should be used to smoke-test the built static bundle
