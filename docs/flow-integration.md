# Flow Integration

Recommended interaction pattern:

1. browser begins at `auth-server /v1/oauth2/authorize`
2. `auth-server` creates `authorization_requests`
3. `auth-server` redirects browser to `auth-ui` with `request_id`
4. `auth-ui` fetches `GET /v1/auth/requests/:request_id`
5. `auth-ui` renders the correct page for the returned `stage`
6. `auth-ui` calls the next `auth-server` action endpoint

Rules:

- treat `request_id` as an opaque flow identifier
- do not reconstruct raw OAuth parameters in the UI
- do not store provider tokens in the UI
- render only from safe flow context returned by `auth-server`
