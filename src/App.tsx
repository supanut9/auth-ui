import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import './App.css'
import { appConfig } from './config'
import type {
  FlowActionResult,
  FlowContext,
  FlowStage,
} from './flow'
import {
  acceptConsent,
  globalLogout,
  loadFlowContext,
  localLogout,
  rejectConsent,
  resendOtp,
  startGitHubLogin,
  startGoogleLogin,
  startOtp,
  verifyOtp,
} from './flow'
import { getUiRoute, type UiRoute } from './routes'

type FlowPanelState =
  | {
      status: 'loading'
      flow: null
      error: null
    }
  | {
      status: 'ready'
      flow: FlowContext | null
      error: null
    }
  | {
      status: 'error'
      flow: null
      error: string
    }

type StageView = 'login' | 'consent' | 'otp' | 'transition' | 'error'

function App() {
  const route = getUiRoute(window.location.pathname)
  const searchParams = new URLSearchParams(window.location.search)
  const requestId = searchParams.get('request_id') ?? ''
  const emailParam = searchParams.get('email') ?? ''

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Hosted auth UI</p>
          <h1>{appConfig.appName}</h1>
          <p className="lede">
            Route-driven login, consent, OTP, and logout pages for the centralized
            authorization server.
          </p>
        </div>

        <div className="hero-meta">
          <span>Auth server</span>
          <strong>{appConfig.authServerUrl}</strong>
          <span>Auth UI</span>
          <strong>{appConfig.authUiUrl}</strong>
          <span>Request</span>
          <strong>{requestId || 'none'}</strong>
        </div>
      </section>

      <section className="page-panel">
        <AuthPage route={route} requestId={requestId} emailParam={emailParam} />
      </section>
    </main>
  )
}

type AuthPageProps = {
  route: UiRoute
  requestId: string
  emailParam: string
}

function AuthPage({ route, requestId, emailParam }: AuthPageProps) {
  const [panelState, setPanelState] = useState<FlowPanelState>(() =>
    requestId ? { status: 'loading', flow: null, error: null } : { status: 'ready', flow: null, error: null },
  )
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function run() {
      if (!requestId) {
        setPanelState({ status: 'ready', flow: null, error: null })
        return
      }

      setPanelState({ status: 'loading', flow: null, error: null })
      const result = await loadFlowContext(requestId)
      if (!active) {
        return
      }

      if (result.ok) {
        setPanelState({ status: 'ready', flow: result.flow, error: null })
        return
      }

      setPanelState({ status: 'error', flow: null, error: result.message })
    }

    void run()

    return () => {
      active = false
    }
  }, [requestId])

  if (panelState.status === 'loading') {
    return (
      <CardShell
        route={route}
        title="Loading"
        subtitle="Fetching flow context from auth-server."
        requestId={requestId}
      >
        <p className="hint">This page is waiting for the pending authorization request.</p>
      </CardShell>
    )
  }

  if (panelState.status === 'error') {
    return (
      <ErrorPage
        flow={null}
        requestId={requestId}
        detail={panelState.error}
      />
    )
  }

  const flow = panelState.flow

  if (route === '/logout') {
    return <LogoutPage requestId={requestId} global={false} setMessage={setMessage} />
  }

  if (route === '/logout/global') {
    return <LogoutPage requestId={requestId} global setMessage={setMessage} />
  }

  if (route === '/error') {
    return (
      <ErrorPage
        flow={flow}
        requestId={requestId}
        detail={message}
      />
    )
  }

  switch (getStageView(flow?.stage, route)) {
    case 'consent':
      return (
        <ConsentPage
          key={flow?.request_id || requestId || 'consent'}
          flow={flow}
          requestId={requestId}
          message={message}
          setMessage={setMessage}
        />
      )
    case 'otp':
      return (
        <OtpPage
          key={flow?.request_id || requestId || 'otp'}
          flow={flow}
          requestId={requestId}
          emailParam={emailParam}
          message={message}
          setMessage={setMessage}
        />
      )
    case 'transition':
      return <TransitionPage flow={flow} requestId={requestId} />
    case 'error':
      return (
        <ErrorPage
          flow={flow}
          requestId={requestId}
          detail={message}
        />
      )
    case 'login':
    default:
      return (
        <LoginPage
          key={flow?.request_id || requestId || 'login'}
          flow={flow}
          requestId={requestId}
          message={message}
          setMessage={setMessage}
        />
      )
  }
}

function getStageView(stage: FlowStage | undefined, route: UiRoute): StageView {
  if (!stage) {
    return route === '/consent' ? 'consent' : route === '/otp' ? 'otp' : 'login'
  }

  switch (stage) {
    case 'login_required':
      return 'login'
    case 'provider_redirect':
    case 'authorization_ready':
    case 'completed':
      return 'transition'
    case 'otp_required':
      return 'otp'
    case 'consent_required':
      return 'consent'
    case 'failed':
    case 'expired':
      return 'error'
  }
}

type PageProps = {
  flow: FlowContext | null
  requestId: string
}

type FlowMessageProps = {
  message: string | null
  setMessage: (message: string | null) => void
}

function LoginPage({ flow, requestId, message, setMessage }: PageProps & FlowMessageProps) {
  const [email, setEmail] = useState(flow?.otp.masked_email ?? '')
  const [busy, setBusy] = useState<'google' | 'github' | 'otp' | null>(null)

  const loginMethods = flow?.available_login_methods ?? ['google', 'github', 'email_otp']
  const canAct = Boolean(requestId)

  return (
    <CardShell
      route="/login"
      title={flow ? flow.client.display_name : 'Login'}
      subtitle="Choose a login method for the pending authorization request."
      requestId={requestId}
      flow={flow}
      message={message}
    >
      {!canAct && (
        <p className="hint">
          A `request_id` is required. Start the flow from auth-server so this page can load
          the pending authorization context.
        </p>
      )}

      <ActionGroup>
        {loginMethods.includes('google') && (
          <ActionButton
            label="Continue with Google"
            busy={busy === 'google'}
            disabled={!canAct}
            onClick={async () => {
              if (!canAct) {
                setMessage('Missing request_id.')
                return
              }
              setMessage(null)
              setBusy('google')
              const result = await startGoogleLogin(requestId)
              setBusy(null)
              handleActionResult(result, setMessage)
            }}
          />
        )}

        {loginMethods.includes('github') && (
          <ActionButton
            label="Continue with GitHub"
            busy={busy === 'github'}
            disabled={!canAct}
            onClick={async () => {
              if (!canAct) {
                setMessage('Missing request_id.')
                return
              }
              setMessage(null)
              setBusy('github')
              const result = await startGitHubLogin(requestId)
              setBusy(null)
              handleActionResult(result, setMessage)
            }}
          />
        )}
      </ActionGroup>

      {loginMethods.includes('email_otp') && (
        <form
          className="inline-form"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!canAct) {
              setMessage('Missing request_id.')
              return
            }
            setMessage(null)
            setBusy('otp')
            const result = await startOtp(requestId, email.trim())
            setBusy(null)
            if (result.ok && !result.authorizationUrl && !result.redirectTo) {
              setMessage('Verification code sent. Enter the code on the OTP page.')
              window.location.assign(
                `${appConfig.authUiUrl}/otp?request_id=${encodeURIComponent(requestId)}&email=${encodeURIComponent(email.trim())}`,
              )
              return
            }
            handleActionResult(result, setMessage)
          }}
        >
          <label>
            Email for OTP recovery or native login
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              disabled={!canAct}
            />
          </label>
          <ActionButton label="Send OTP" busy={busy === 'otp'} disabled={!canAct} type="submit" />
        </form>
      )}
    </CardShell>
  )
}

function ConsentPage({ flow, requestId, message, setMessage }: PageProps & FlowMessageProps) {
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null)
  const canAct = Boolean(requestId)

  return (
    <CardShell
      route="/consent"
      title={flow ? flow.client.display_name : 'Consent'}
      subtitle="Review requested scopes before the authorization code is issued."
      requestId={requestId}
      flow={flow}
      message={message}
    >
      {!canAct && (
        <p className="hint">
          A `request_id` is required. Open the consent page from the pending authorization
          flow.
        </p>
      )}

      <ScopeList scopes={flow?.requested_scopes ?? []} />

      <ActionRow>
        <ActionButton
          label="Approve"
          busy={busy === 'accept'}
          disabled={!canAct}
          onClick={async () => {
            if (!canAct) {
              setMessage('Missing request_id.')
              return
            }
            setMessage(null)
            setBusy('accept')
            const result = await acceptConsent(requestId)
            setBusy(null)
            handleActionResult(result, setMessage)
          }}
        />
        <ActionButton
          label="Reject"
          secondary
          busy={busy === 'reject'}
          disabled={!canAct}
          onClick={async () => {
            if (!canAct) {
              setMessage('Missing request_id.')
              return
            }
            setMessage(null)
            setBusy('reject')
            const result = await rejectConsent(requestId)
            setBusy(null)
            handleActionResult(result, setMessage)
          }}
        />
      </ActionRow>
    </CardShell>
  )
}

function OtpPage({
  flow,
  requestId,
  emailParam,
  message,
  setMessage,
}: PageProps &
  FlowMessageProps & {
    emailParam: string
  }) {
  const [email, setEmail] = useState(emailParam || '')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'verify' | 'resend' | null>(null)
  const canAct = Boolean(requestId)

  return (
    <CardShell
      route="/otp"
      title="Email OTP"
      subtitle="Verify the email-based one-time password used for login or recovery."
      requestId={requestId}
      flow={flow}
      message={message}
    >
      {!canAct && (
        <p className="hint">
          A `request_id` is required. Open the OTP page from the pending authorization flow.
        </p>
      )}

      <form
        className="inline-form"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!canAct) {
            setMessage('Missing request_id.')
            return
          }
          setMessage(null)
          setBusy('verify')
          const result = await verifyOtp(requestId, email.trim(), code.trim())
          setBusy(null)
          handleActionResult(result, setMessage)
        }}
      >
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            disabled={!canAct}
          />
        </label>
        <label>
          OTP Code
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456"
            disabled={!canAct}
          />
        </label>
        <ActionRow>
          <ActionButton label="Verify" busy={busy === 'verify'} disabled={!canAct} type="submit" />
          <ActionButton
          label="Resend"
          secondary
          busy={busy === 'resend'}
          disabled={!canAct}
          onClick={async () => {
              if (!canAct) {
                setMessage('Missing request_id.')
                return
              }
              setMessage(null)
              setBusy('resend')
              const result = await resendOtp(requestId, email.trim())
              setBusy(null)
              if (result.ok && !result.authorizationUrl && !result.redirectTo) {
                setMessage('Verification code resent.')
                return
              }
              handleActionResult(result, setMessage)
            }}
          />
        </ActionRow>
      </form>

      <p className="hint">
        This page is driven by the pending request state returned from auth-server.
      </p>
    </CardShell>
  )
}

function LogoutPage({
  requestId,
  global,
  setMessage,
}: {
  requestId: string
  global: boolean
  setMessage: (message: string | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const redirectUrl = global ? globalLogout() : localLogout()

  return (
    <CardShell
      route={global ? '/logout/global' : '/logout'}
      title={global ? 'Global logout' : 'Local logout'}
      subtitle={
        global
          ? 'Clear the central SSO session and revoke refresh-token chains.'
          : 'Clear only the current client session.'
      }
      requestId={requestId}
      message={null}
    >
      <ActionButton
        label={global ? 'Sign out everywhere' : 'Sign out from this app'}
        busy={busy}
        onClick={async () => {
          setMessage(null)
          setBusy(true)
          const result = redirectUrl
          setBusy(false)
          handleActionResult(result, setMessage)
        }}
      />
    </CardShell>
  )
}

function TransitionPage({ flow, requestId }: PageProps) {
  const stage = flow?.stage
  const title =
    stage === 'provider_redirect'
      ? 'Redirecting to provider'
      : stage === 'authorization_ready'
        ? 'Completing authorization'
        : 'Authorization complete'
  const subtitle =
    stage === 'provider_redirect'
      ? 'auth-server is sending the browser to the external login provider.'
      : stage === 'authorization_ready'
        ? 'Consent is complete. auth-server should issue the authorization code next.'
        : 'auth-server should redirect the browser back to the client now.'

  return (
    <CardShell
      route="/login"
      title={title}
      subtitle={subtitle}
      requestId={requestId}
      flow={flow}
    >
      <p className="hint">
        This is a transitional state. The browser should not stay here for long.
      </p>
    </CardShell>
  )
}

function ErrorPage({
  flow,
  requestId,
  detail,
}: PageProps & {
  detail: string | null
}) {
  return (
    <CardShell
      route="/error"
      title="Auth error"
      subtitle="Render a safe terminal error state for the current flow."
      requestId={requestId}
      flow={flow}
      message={detail}
    >
      <p className="hint">
        If this request is still valid, auth-server should return the client to its redirect
        URI with RFC-style OAuth error details.
      </p>
    </CardShell>
  )
}

function CardShell({
  route,
  title,
  subtitle,
  requestId,
  flow,
  message,
  children,
}: {
  route: UiRoute
  title: string
  subtitle: string
  requestId: string
  flow?: FlowContext | null
  message?: string | null
  children?: ReactNode
}) {
  return (
    <article className="card">
      <div className="card-topline">
        <span className="route-badge">{route}</span>
        <span className="request-pill">{requestId || 'no request_id'}</span>
      </div>

      <header className="card-header">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>

      {flow && <FlowSnapshot flow={flow} />}
      {message && <MessageBanner message={message} />}

      <div className="card-body">{children}</div>
    </article>
  )
}

function FlowSnapshot({ flow }: { flow: FlowContext }) {
  return (
    <section className="snapshot" aria-label="Flow context">
      <div>
        <span>Client</span>
        <strong>{flow.client.display_name}</strong>
      </div>
      <div>
        <span>Stage</span>
        <strong>{flow.stage}</strong>
      </div>
      <div>
        <span>Scopes</span>
        <strong>{flow.requested_scopes.join(' ') || 'none'}</strong>
      </div>
      <div>
        <span>Expires</span>
        <strong>{new Date(flow.expires_at).toLocaleString()}</strong>
      </div>
      <div>
        <span>Account hint</span>
        <strong>{flow.account_hint?.email ?? flow.account_hint?.display_name ?? 'none'}</strong>
      </div>
    </section>
  )
}

function ScopeList({ scopes }: { scopes: string[] }) {
  if (scopes.length === 0) {
    return <p className="hint">No scopes were requested on this flow.</p>
  }

  return (
    <ul className="scope-list">
      {scopes.map((scope) => (
        <li key={scope}>{scope}</li>
      ))}
    </ul>
  )
}

function ActionGroup({ children }: { children: ReactNode }) {
  return <div className="actions">{children}</div>
}

function ActionRow({ children }: { children: ReactNode }) {
  return <div className="action-row">{children}</div>
}

function ActionButton({
  label,
  busy = false,
  secondary = false,
  disabled = false,
  type = 'button',
  onClick,
}: {
  label: string
  busy?: boolean
  secondary?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
  onClick?: () => void | Promise<void>
}) {
  return (
    <button
      className={secondary ? 'button button-secondary' : 'button'}
      type={type}
      onClick={onClick}
      disabled={busy || disabled}
    >
      {busy ? 'Working...' : label}
    </button>
  )
}

function MessageBanner({ message }: { message: string }) {
  return <div className="message-banner">{message}</div>
}

function handleActionResult(
  result: FlowActionResult,
  setMessage: (message: string | null) => void,
) {
  if (result.ok) {
    if (result.authorizationUrl) {
      window.location.assign(result.authorizationUrl)
      return
    }
    if (result.redirectTo) {
      window.location.assign(result.redirectTo)
      return
    }

    setMessage('Action completed. Awaiting auth-server redirect.')
    return
  }

  setMessage(result.message)
}

export default App
