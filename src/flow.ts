import { appConfig } from './config'

export type UiRoute =
  | '/login'
  | '/consent'
  | '/otp'
  | '/logout'
  | '/logout/global'
  | '/error'

export type FlowStage =
  | 'login_required'
  | 'provider_redirect'
  | 'otp_required'
  | 'consent_required'
  | 'authorization_ready'
  | 'completed'
  | 'failed'
  | 'expired'

export type FlowContext = {
  request_id: string
  stage: FlowStage
  expires_at: string
  client: {
    client_id: string
    display_name: string
  }
  requested_scopes: string[]
  available_login_methods: Array<'google' | 'github' | 'email_otp'>
  consent: {
    required: boolean
  }
  otp: {
    required: boolean
    masked_email: string | null
  }
  account_hint?: {
    display_name: string | null
    email: string | null
  } | null
}

export type FlowActionResult =
  | {
      ok: true
      redirectTo?: string
      authorizationUrl?: string
    }
  | {
      ok: false
      message: string
    }

export type FlowLoadResult =
  | {
      ok: true
      flow: FlowContext | null
    }
  | {
      ok: false
      message: string
    }

async function callJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${appConfig.authServerUrl}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return (await response.json()) as T
}

async function callAction(
  path: string,
  body: Record<string, unknown>,
): Promise<FlowActionResult> {
  try {
    const response = await fetch(`${appConfig.authServerUrl}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (response.redirected) {
      return { ok: true, redirectTo: response.url }
    }

    if (response.ok) {
      const data = (await response.json().catch(() => null)) as
        | { redirect_to?: string; redirectTo?: string; authorization_url?: string; authorizationUrl?: string }
        | null

      return {
        ok: true,
        redirectTo: data?.redirect_to ?? data?.redirectTo,
        authorizationUrl: data?.authorization_url ?? data?.authorizationUrl,
      }
    }

    const data = (await response.json().catch(() => null)) as
      | { error?: string; error_description?: string; message?: string }
      | null

    return {
      ok: false,
      message:
        data?.error_description ?? data?.message ?? `Request failed: ${response.status}`,
    }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : 'Unable to contact auth-server',
    }
  }
}

export async function loadFlowContext(
  requestId: string,
): Promise<FlowLoadResult> {
  if (!requestId) {
    return { ok: true, flow: null }
  }

  try {
    return { ok: true, flow: await callJson<FlowContext>(`/v1/auth/requests/${requestId}`) }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unable to load flow context',
    }
  }
}

export function startGoogleLogin(requestId: string): Promise<FlowActionResult> {
  return callAction('/v1/auth/login/google', { request_id: requestId })
}

export function startGitHubLogin(requestId: string): Promise<FlowActionResult> {
  return callAction('/v1/auth/login/github', { request_id: requestId })
}

export function startOtp(requestId: string, email: string): Promise<FlowActionResult> {
  return callAction('/v1/auth/otp/start', { request_id: requestId, email })
}

export function verifyOtp(
  requestId: string,
  email: string,
  code: string,
): Promise<FlowActionResult> {
  return callAction('/v1/auth/otp/verify', { request_id: requestId, email, code })
}

export function resendOtp(requestId: string, email: string): Promise<FlowActionResult> {
  return callAction('/v1/auth/otp/resend', { request_id: requestId, email })
}

export function acceptConsent(requestId: string): Promise<FlowActionResult> {
  return callAction('/v1/auth/consent/accept', { request_id: requestId })
}

export function rejectConsent(requestId: string): Promise<FlowActionResult> {
  return callAction('/v1/auth/consent/reject', { request_id: requestId })
}

export function localLogout(): FlowActionResult {
  return {
    ok: true,
    redirectTo: `${appConfig.authServerUrl}/v1/auth/logout`,
  }
}

export function globalLogout(): FlowActionResult {
  return {
    ok: true,
    redirectTo: `${appConfig.authServerUrl}/v1/auth/logout/global`,
  }
}
