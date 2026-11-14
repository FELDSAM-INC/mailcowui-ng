const LOCAL_UI_ORIGINS = new Set([
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

/** A scenario switch may return to a local UI or the operator's explicitly configured APP_URL. */
export function mockRedirect(value: string | null, appUrl: string): string | null {
  try {
    const configured = new URL(appUrl)
    const target = new URL(value ?? appUrl, configured)
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password)
      return null
    if (target.origin !== configured.origin && !LOCAL_UI_ORIGINS.has(target.origin)) return null
    return target.href
  } catch {
    return null
  }
}

/** Routing uses a fixed base, never an untrusted Host header or an absolute-form request target. */
export function mockRequestUrl(target: string | undefined): URL | null {
  try {
    if (!target?.startsWith('/')) return null
    const url = new URL(target, 'http://127.0.0.1:4010')
    return url.origin === 'http://127.0.0.1:4010' ? url : null
  } catch {
    return null
  }
}
