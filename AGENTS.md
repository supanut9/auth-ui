# AGENTS.md

This service is the phase-1 hosted auth UI.

## Stack

- React
- Vite
- TypeScript

## Service Responsibilities

- render login page
- render consent page
- render OTP page
- render logout and error pages
- call `auth-server` flow endpoints

## Do Not Own

- OAuth/OIDC protocol logic
- provider callback handling
- token issuance
- central SSO policy

Those belong to `auth-server`.

## Read Before Coding

- `../docs/phase-1-ui-contract.md`
- `../docs/phase-1-endpoints.md`
- `../docs/auth-flow.md`

## UI Rules

- use `request_id` as an opaque flow identifier
- render only from safe flow context returned by `auth-server`
- do not reconstruct raw OAuth parameters in the UI
- do not store provider tokens in the UI
- route by `stage` from the flow context

## Phase 1 Pages

- `/login`
- `/consent`
- `/otp`
- `/logout`
- `/logout/global`
- `/error`
