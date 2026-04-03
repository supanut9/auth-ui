import { appConfig } from '../src/config'

const routes = ['/', '/login', '/consent', '/otp', '/logout', '/logout/global', '/error']

async function main() {
  const failures: string[] = []

  for (const route of routes) {
    const response = await fetch(`${appConfig.authUiUrl}${route}`)
    const body = await response.text()

    if (!response.ok) {
      failures.push(`${route}: unexpected status ${response.status}`)
      continue
    }

    if (!response.headers.get('content-type')?.includes('text/html')) {
      failures.push(`${route}: missing HTML content type`)
      continue
    }

    if (!body.includes('id="root"')) {
      failures.push(`${route}: missing root mount point`)
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure)
    }
    process.exit(1)
  }

  console.log(`auth-ui smoke checks passed against ${appConfig.authUiUrl}`)
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
