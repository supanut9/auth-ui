# Routes

Phase-1 pages:

- `/login`
- `/consent`
- `/otp`
- `/logout`
- `/logout/global`
- `/error`

Rules:

- pages use `request_id` when they belong to an authorization flow
- pages render based on flow context from `auth-server`
- `provider_redirect` and `authorization_ready` are transitional states and should not require complex dedicated pages
