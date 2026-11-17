// Mock diagnostics are shared with browser tests and manual development sessions. Retain
// request shape, never credentials; suffix matching also covers new provider-specific fields.
function sensitive(name: string): boolean {
  const key = name.replace(/[-_]/g, '').toLowerCase()
  return (
    /(?:password|secret|token|credential|privatekey|apikey|userkey)$/.test(key) ||
    ['code', 'otp', 'state', 'authorization', 'cookie'].includes(key)
  )
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        sensitive(key) ? '[redacted]' : redact(inner),
      ]),
    )
  }
  return value
}

export function recordedHeaders(headers: Headers): Record<string, string> {
  const allowed = new Set([
    'x-csrf-token',
    'x-api-key',
    'if-match',
    'if-none-match',
    'content-type',
    'referer',
  ])
  return Object.fromEntries(
    [...headers]
      .filter(([name]) => allowed.has(name))
      .map(([name, value]) => [name, sensitive(name) ? '[redacted]' : value]),
  )
}
