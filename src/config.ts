export type AppConfig = {
  authServerUrl: string
  authUiUrl: string
  appName: string
}

function readEnv(name: string, fallback = ''): string {
  const value = import.meta.env[name]
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

export const appConfig: AppConfig = {
  authServerUrl: readEnv('VITE_AUTH_SERVER_URL', 'http://localhost:8050'),
  authUiUrl: readEnv('VITE_AUTH_UI_URL', 'http://localhost:3005'),
  appName: readEnv('VITE_APP_NAME', 'auth-ui'),
}
