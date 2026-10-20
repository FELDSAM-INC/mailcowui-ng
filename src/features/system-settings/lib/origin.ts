// Mirrors API LegacyOrigin: an authority only, without URL's forgiving path/credential fixes.
export function isOrigin(value: string): boolean {
  if (value === '*') return true
  const match = /^(https?):\/\/(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::([0-9]+))?$/i.exec(value)
  if (!match) return false
  const host = match[2]!
  const port = match[3]
  if (port && (Number(port) > 65535 || String(Number(port)) !== port)) return false
  if (host.startsWith('[')) {
    try {
      new URL(value)
      return true
    } catch {
      return false
    }
  }
  return (
    host.length <= 253 &&
    host
      .replace(/\.$/, '')
      .split('.')
      .every((label) => label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))
  )
}
export function parseOrigins(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\s,;]+/)
        .filter(Boolean)
        .map((origin) => origin.toLowerCase()),
    ),
  ]
}
