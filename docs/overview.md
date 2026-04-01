# Overview

`auth-ui` is the phase-1 hosted auth UI.

It owns:

- rendered login pages
- rendered consent pages
- rendered OTP pages
- logout and error pages
- browser interaction with `auth-server`

It does not own:

- OAuth/OIDC protocol logic
- provider callback handling
- token issuance
- central SSO policy

Those belong to `auth-server`.
