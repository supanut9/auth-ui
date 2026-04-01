export type UiRoute =
  | '/login'
  | '/consent'
  | '/otp'
  | '/logout'
  | '/logout/global'
  | '/error'

const routeSet = new Set<UiRoute>([
  '/login',
  '/consent',
  '/otp',
  '/logout',
  '/logout/global',
  '/error',
])

export function getUiRoute(pathname: string): UiRoute {
  if (routeSet.has(pathname as UiRoute)) {
    return pathname as UiRoute
  }

  return '/login'
}

