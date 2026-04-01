import './App.css'
import { appConfig } from './config'
import { getUiRoute } from './routes'

function App() {
  const route = getUiRoute(window.location.pathname)

  return (
    <main className="shell">
      <section className="panel">
        <header className="hero">
          <p className="eyebrow">Hosted auth UI</p>
          <h1>{appConfig.appName}</h1>
          <p className="lede">
            Phase-1 login, consent, OTP, and logout pages for the centralized
            authorization server.
          </p>
        </header>

        <section className="route-card" aria-label="Current route">
          <div className="route-path">{route}</div>
          <h2>{routeTitle(route)}</h2>
          <p>{routeDescription(route)}</p>
          <ul className="route-list">
            {routeHints(route).map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        </section>

        <section className="actions" aria-label="Navigation preview">
          <a href="/login">Login</a>
          <a href="/consent">Consent</a>
          <a href="/otp">OTP</a>
          <a href="/logout">Logout</a>
          <a href="/logout/global">Global logout</a>
          <a href="/error">Error</a>
        </section>
      </section>
    </main>
  )
}

function routeTitle(route: string): string {
  switch (route) {
    case '/consent':
      return 'Consent'
    case '/otp':
      return 'Email OTP'
    case '/logout':
      return 'Local logout'
    case '/logout/global':
      return 'Global logout'
    case '/error':
      return 'Error'
    default:
      return 'Login'
  }
}

function routeDescription(route: string): string {
  switch (route) {
    case '/consent':
      return 'Show requested scopes and let the user approve or reject the client request.'
    case '/otp':
      return 'Verify the email-based one-time password used for native login or recovery.'
    case '/logout':
      return 'Clear the local client session and leave central SSO intact.'
    case '/logout/global':
      return 'Clear central SSO and revoke refresh-token chains according to policy.'
    case '/error':
      return 'Render a safe terminal auth error state for the current flow.'
    default:
      return 'Render Google, GitHub, and Email OTP login choices for the pending request.'
  }
}

function routeHints(route: string): string[] {
  switch (route) {
    case '/consent':
      return ['Reads flow context from auth-server', 'Shows scope-based consent text']
    case '/otp':
      return ['Starts and verifies OTP', 'Supports resend and recovery flows']
    case '/logout':
      return ['Client-driven local logout', 'Can revoke the current refresh token chain']
    case '/logout/global':
      return ['Browser-driven global logout', 'Kills SSO for future auth requests']
    case '/error':
      return ['Safe terminal view', 'No raw OAuth parameters']
    default:
      return [
        'Uses request_id from auth-server',
        'Only renders safe flow context',
        'Routes user into consent or OTP when required',
      ]
  }
}

export default App
