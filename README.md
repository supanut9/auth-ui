# auth-ui

Phase-1 hosted login and consent UI for the platform.

## Stack

- React
- Vite
- TypeScript

## Local Defaults

- auth-ui: `http://localhost:3005`
- auth-server: `http://localhost:8050`

## Production Baseline

- `bun run check` runs linting, typecheck, and production build
- `bun run preview` serves the built app on `http://localhost:3005`
- `bun run smoke` verifies the built preview serves the key SPA routes
- invalid browser redirect URLs fail fast during app config initialization
- keep `VITE_AUTH_SERVER_URL`, `VITE_AUTH_UI_URL`, and `VITE_APP_NAME` set for deploys
- `vercel.json` is included so Vercel serves the built SPA and rewrites deep routes like `/login`, `/consent`, and `/logout` back to `index.html`

## Responsibilities

- render login page
- render consent page
- render OTP page
- render logout and error pages
- call `auth-server` flow endpoints

## Read First

- `AGENTS.md`
- `docs/overview.md`
- `docs/routes.md`
- `docs/flow-integration.md`
- `docs/config.md`

## Cross-Service Source Of Truth

Root planning docs remain authoritative for phase 1:

- `../docs/auth/auth-flow.md`
- `../docs/auth/phase-1-ui-contract.md`
- `../docs/auth/phase-1-endpoints.md`
