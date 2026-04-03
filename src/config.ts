export type AppConfig = {
  authServerUrl: string
  authUiUrl: string
  appName: string
}

function readEnv(name: string, fallback = ''): string {
  const value = import.meta.env[name]
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function normalizeUrl(raw: string, name: string): string {
  try {
    return new URL(raw).toString().replace(/\/+$/, '')
  } catch {
    throw new Error(`Invalid ${name}: ${raw}`)
  }
}

function createAppConfig(): AppConfig {
  const authServerUrl = normalizeUrl(
    readEnv('VITE_AUTH_SERVER_URL', 'http://localhost:8050'),
    'VITE_AUTH_SERVER_URL',
  )
  const authUiUrl = normalizeUrl(
    readEnv('VITE_AUTH_UI_URL', 'http://localhost:3005'),
    'VITE_AUTH_UI_URL',
  )
  const appName = readEnv('VITE_APP_NAME', 'auth-ui').trim()

  if (!appName) {
    throw new Error('Invalid VITE_APP_NAME: must not be empty')
  }

  return {
    authServerUrl,
    authUiUrl,
    appName,
  }
}

export const appConfig = createAppConfig()
