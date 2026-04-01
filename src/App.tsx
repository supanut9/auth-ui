import { useEffect, useState } from 'react'
import './App.css'
import { appConfig } from './config'
import {
  acceptConsent,
  globalLogout,
  localLogout,
  loadFlowContext,
  rejectConsent,
  resendOtp,
  startGitHubLogin,
  startGoogleLogin,
  startOtp,
  verifyOtp,
} from './flow'
import type { FlowActionResult, FlowContext } from './flow'
import { getUiRoute, type UiRoute } from './routes'
import type { ReactNode } from 'react'

function App() {
  const route = getUiRoute(window.location.pathname)
  const requestId = new URLSearchParams(window.location.search).get('request_id') ?? ''

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
          <span>Request</span>
          <strong>{requestId || 'none'}</strong>
        </div>
      </section>

      <section className="page-panel">
        <AuthPage route={route} requestId={requestId} />
      </section>
    </main>
  )
}

type AuthPageProps = {
  route: UiRoute
  requestId: string
}

function AuthPage({ route, requestId }: AuthPageProps) {
  const [flow, setFlow] = useState<FlowContext | null>(null)
  const [loading, setLoading] = useState(Boolean(requestId))
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function run() {
      if (!requestId) {
        setFlow(null)
        setLoading(false)
        return
      }

      setLoading(true)
      const context = await loadFlowContext(requestId)
      if (!active) {
        return
      }
      setFlow(context)
      setLoading(false)
    }

    void run()

    return () => {
      active = false
    }
  }, [requestId])

  if (loading) {
    return (
      <CardShell
        route={route}
        title="Loading"
        subtitle="Fetching flow context..."
        requestId={requestId}
      />
    )
  }

  switch (route) {
    case '/consent':
      return (
        <ConsentPage
          flow={flow}
          requestId={requestId}
          message={message}
          setMessage={setMessage}
        />
      )
    case '/otp':
      return (
        <OtpPage
          flow={flow}
          requestId={requestId}
          message={message}
          setMessage={setMessage}
        />
      )
    case '/logout':
      return <LogoutPage requestId={requestId} global={false} setMessage={setMessage} />
    case '/logout/global':
      return <LogoutPage requestId={requestId} global setMessage={setMessage} />
    case '/error':
      return <ErrorPage flow={flow} requestId={requestId} />
    case '/login':
    default:
      return (
        <LoginPage
          flow={flow}
          requestId={requestId}
          message={message}
          setMessage={setMessage}
        />
      )
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

function LoginPage({
  flow,
  requestId,
  message,
  setMessage,
}: PageProps & FlowMessageProps) {
  const [email, setEmail] = useState(flow?.otp.masked_email ?? '')
  const [busy, setBusy] = useState<'google' | 'github' | 'otp' | null>(null)

  useEffect(() => {
    setEmail(flow?.otp.masked_email ?? '')
  }, [flow?.otp.masked_email])

  const loginMethods = flow?.available_login_methods ?? ['google', 'github', 'email_otp']

  return (
    <CardShell
      route="/login"
      title={flow ? flow.client.display_name : 'Login'}
      subtitle="Choose a login method for the pending authorization request."
      requestId={requestId}
      flow={flow}
      message={message}
    >
      <ActionGroup>
        {loginMethods.includes('google') && (
          <ActionButton
            label="Continue with Google"
            busy={busy === 'google'}
            onClick={async () => {
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
            onClick={async () => {
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
            setMessage(null)
            setBusy('otp')
            const result = await startOtp(requestId, email.trim())
            setBusy(null)
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
            />
          </label>
          <ActionButton label="Send OTP" busy={busy === 'otp'} type="submit" />
        </form>
      )}
    </CardShell>
  )
}

function ConsentPage({
  flow,
  requestId,
  message,
  setMessage,
}: PageProps & FlowMessageProps) {
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null)

  return (
    <CardShell
      route="/consent"
      title={flow ? flow.client.display_name : 'Consent'}
      subtitle="Review requested scopes before the authorization code is issued."
      requestId={requestId}
      flow={flow}
      message={message}
    >
      <ScopeList scopes={flow?.requested_scopes ?? []} />

      <ActionRow>
        <ActionButton
          label="Approve"
          busy={busy === 'accept'}
          onClick={async () => {
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
          onClick={async () => {
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

function OtpPage({ flow, requestId, message, setMessage }: PageProps & FlowMessageProps) {
  const [email, setEmail] = useState(flow?.otp.masked_email ?? '')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'send' | 'verify' | 'resend' | null>(null)

  useEffect(() => {
    setEmail(flow?.otp.masked_email ?? '')
  }, [flow?.otp.masked_email])

  return (
    <CardShell
      route="/otp"
      title="Email OTP"
      subtitle="Verify the email-based one-time password used for login or recovery."
      requestId={requestId}
      flow={flow}
      message={message}
    >
      <form
        className="inline-form"
        onSubmit={async (event) => {
          event.preventDefault()
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
          />
        </label>
        <ActionRow>
          <ActionButton label="Verify" busy={busy === 'verify'} type="submit" />
          <ActionButton
            label="Resend"
            secondary
            busy={busy === 'resend'}
            onClick={async () => {
              setMessage(null)
              setBusy('resend')
              const result = await resendOtp(requestId, email.trim())
              setBusy(null)
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
          const result = global ? await globalLogout() : await localLogout()
          setBusy(false)
          handleActionResult(result, setMessage)
        }}
      />
    </CardShell>
  )
}

function ErrorPage({ flow, requestId }: PageProps) {
  return (
    <CardShell
      route="/error"
      title="Auth error"
      subtitle="Render a safe terminal error state for the current flow."
      requestId={requestId}
      flow={flow}
      message={null}
    >
      <p className="hint">
        If this request is still valid, auth-server should return the client to its
        redirect URI with RFC-style OAuth error details.
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
  type = 'button',
  onClick,
}: {
  label: string
  busy?: boolean
  secondary?: boolean
  type?: 'button' | 'submit'
  onClick?: () => void | Promise<void>
}) {
  return (
    <button
      className={secondary ? 'button button-secondary' : 'button'}
      type={type}
      onClick={onClick}
      disabled={busy}
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
