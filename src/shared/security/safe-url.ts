// Checks operator-supplied link addresses such as app links (FR-001a, research R17). Only
// absolute http(s) URLs and same-origin paths are rendered; anything else, such as `javascript:`,
// `data:` or a protocol-relative `//host`, is dropped.

// Control characters (tabs, newlines, NUL) are never part of a link address.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/

export function safeHref(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const href = value.trim()
  if (href === '' || CONTROL_CHARACTERS.test(href)) return null

  if (href.startsWith('/')) {
    // Browsers treat `//host` and `/\host` as another origin.
    return href.startsWith('//') || href.startsWith('/\\') ? null : href
  }

  if (!/^https?:\/\//i.test(href)) return null
  try {
    const url = new URL(href)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== ''
      ? href
      : null
  } catch {
    return null
  }
}
