// Text downloads under the strict CSP (conventions "Shared building blocks": downloads; UI 010
// research R13): a Blob with exactly the given text (no byte order mark, no newline conversion),
// clicked through a detached `<a download>` and revoked right after. Never a `data:` URL, never
// storage. First used by UI 010 (zone files, private key exports); UI 005 reuses it.

export function downloadText(text: string, fileName: string, mediaType: string): void {
  const blob = new Blob([text], { type: `${mediaType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

// UI 006 (research R10, data-model §2 "Download target"): files the API serves (quarantine
// attachments and messages) are fetched through the normal client, so a refusal becomes an
// ApiProblem with a translated reason, and saved, never displayed: the bytes are wrapped as
// `application/octet-stream` whatever the declared type, so no browser previews them. The name
// comes from `Content-Disposition` (RFC 8187 `filename*` first) and is sanitised again as defence
// in depth. The object URL is revoked after one second; nothing is stored.

/** The longest file name that is saved. */
export const FILE_NAME_MAX_LENGTH = 200

/** Revocation delay of a saved blob's object URL, in milliseconds. */
export const REVOKE_AFTER_MS = 1000

function decodeExtValue(value: string): string | null {
  // RFC 8187: charset'language'percent-encoded value. Only UTF-8 (and its ASCII subset) is read.
  const match = /^([A-Za-z0-9!#$%&+^_`{}~-]*)'[^']*'(.*)$/.exec(value)
  if (!match) return null
  const charset = match[1]!.toLowerCase()
  if (charset !== 'utf-8' && charset !== 'us-ascii' && charset !== 'iso-8859-1') return null
  try {
    if (charset === 'iso-8859-1') {
      return match[2]!.replace(/%([0-9A-Fa-f]{2})/g, (_, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
      )
    }
    return decodeURIComponent(match[2]!)
  } catch {
    return null
  }
}

function unquote(value: string): string {
  const trimmed = value.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/\\(.)/g, '$1')
  }
  return trimmed
}

/** Splits header parameters on `;` outside quoted strings. */
function headerParams(header: string): Map<string, string> {
  const params = new Map<string, string>()
  let current = ''
  let quoted = false
  const parts: string[] = []
  for (let index = 0; index < header.length; index += 1) {
    const char = header[index]!
    if (char === '\\' && quoted) {
      current += char + (header[index + 1] ?? '')
      index += 1
      continue
    }
    if (char === '"') quoted = !quoted
    if (char === ';' && !quoted) {
      parts.push(current)
      current = ''
      continue
    }
    current += char
  }
  parts.push(current)
  for (const part of parts.slice(1)) {
    const at = part.indexOf('=')
    if (at < 0) continue
    const name = part.slice(0, at).trim().toLowerCase()
    if (name && !params.has(name)) params.set(name, part.slice(at + 1).trim())
  }
  return params
}

/** The file name of a `Content-Disposition` header: `filename*` (RFC 8187), then `filename`. */
export function parseContentDisposition(header: string | null | undefined): string | null {
  if (!header) return null
  const params = headerParams(header)
  const extended = params.get('filename*')
  if (extended !== undefined) {
    const decoded = decodeExtValue(unquote(extended))
    if (decoded) return decoded
  }
  const plain = params.get('filename')
  if (plain !== undefined) {
    const value = unquote(plain)
    if (value) return value
  }
  return null
}

// Path separators, controls (C0, DEL, C1), bidi embeddings, overrides, isolates and marks, line and
// paragraph separators, the BOM, and characters that file systems refuse.
const UNSAFE_NAME =
  /[/\\\u{0}-\u{1F}\u{7F}-\u{9F}\u{61C}\u{200E}\u{200F}\u{2028}\u{2029}\u{202A}-\u{202E}\u{2066}-\u{2069}\u{FEFF}<>:"|?*]/gu

/**
 * A safe file name: unsafe characters become `_`, leading dots and trailing dots or spaces are
 * trimmed, and the name is cut to 200 characters (keeping the extension where possible). An empty
 * result gives the fallback.
 */
export function sanitiseFileName(name: string, fallback: string): string {
  let value = name.replace(UNSAFE_NAME, '_').trim()
  value = value.replace(/^[.\s]+/, '').replace(/[.\s]+$/, '')
  if (value.length > FILE_NAME_MAX_LENGTH) {
    const dot = value.lastIndexOf('.')
    const extension = dot > 0 && value.length - dot <= 16 ? value.slice(dot) : ''
    value = value.slice(0, FILE_NAME_MAX_LENGTH - extension.length) + extension
  }
  if (value === '' || /^_+$/.test(value)) return fallback === name ? 'download' : fallback
  return value
}

/** Saves bytes as a file, never displayed: an octet-stream blob behind a detached link. */
export function saveBlob(data: Blob | ArrayBuffer | Uint8Array, fileName: string): void {
  const blob = new Blob([data as BlobPart], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS)
}

/**
 * Fetches a file through the API client (`parseAs: 'blob'`) and saves it under the name the API
 * gives, or the fallback. A refusal rejects with the client's ApiProblem and saves nothing.
 * Resolves with the saved name once the click has been dispatched.
 */
export async function saveApiFile(
  fetcher: () => Promise<{ data?: Blob; response: Response }>,
  fallbackName: string,
): Promise<string> {
  const { data, response } = await fetcher()
  if (data === undefined) throw new Error('The download has no body')
  const given = parseContentDisposition(response.headers.get('content-disposition'))
  const name = sanitiseFileName(given ?? fallbackName, fallbackName)
  saveBlob(data, name)
  return name
}
