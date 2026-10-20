// Sanitisers for HTML the app shows (research R17), rendered only through SanitizedHtml.vue, the
// one place that uses v-html:
// - operator-authored HTML: the login help text and the footer (FR-002);
// - the markup in mailcow's own language values (`<b>`, `<br>`, `<code>`, links and lists), shown
//   verbatim (constitution IV 1.3.0) through a small allowlist of what those values use.
import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'small',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'a',
  'blockquote',
]

// A dedicated instance, so the hook below never affects other users of DOMPurify.
const purify = DOMPurify(window)

purify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('rel', 'noopener noreferrer nofollow')
  }
})

const STYLE_ELEMENT = /<style\b[\s\S]*?(?:<\/style\s*>|$)/gi
const INLINE_ATTRIBUTE = /(<[a-z][^>]*?[\s/])(on[a-z]+|style)(\s*=)/gi

/**
 * Chromium reports CSP violations for inline event handlers and styles even in documents that are
 * only parsed (DOMParser, `<template>`), although it blocks them. Hostile operator HTML would raise
 * such reports while DOMPurify parses it, so these parts are defanged as text first: style
 * elements are dropped and handler and style attributes renamed to `data-removed-*`, which
 * DOMPurify then removes. This is noise reduction, not the security boundary: DOMPurify is.
 */
export function defangForParsing(html: string): string {
  let result = html.replace(STYLE_ELEMENT, '')
  for (let pass = 0; pass < 20; pass += 1) {
    const next = result.replace(INLINE_ATTRIBUTE, '$1data-removed-$2$3')
    if (next === result) break
    result = next
  }
  return result
}

const LEGACY_TAGS = [
  'b',
  'strong',
  'i',
  'em',
  'br',
  'small',
  'code',
  'ul',
  'ol',
  'li',
  'p',
  'span',
  'div',
  'a',
]

// http(s), mailto, and relative references (`/api`, `#`, `../x`); never `//host` or other schemes.
const LEGACY_URI = /^(?:https?:|mailto:|\/(?!\/)|\.\.?\/|[#?]|[^:/?#]+(?:[/?#]|$))/i

// Its own instance, so that its hook never touches operator HTML.
const legacyPurify = DOMPurify(window)

legacyPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName !== 'A') return
  if (node.getAttribute('target') !== '_blank') node.removeAttribute('target')
  if (node.hasAttribute('href')) node.setAttribute('rel', 'noopener noreferrer')
  else node.removeAttribute('target')
})

// Tables repeat the same small HTML translations (especially the yes/no entities). Cache only
// strings, after sanitizing with this fixed profile; cap both their count and input length.
const legacyCache = new Map<string, string>()
const LEGACY_CACHE_LIMIT = 128
const LEGACY_CACHE_INPUT_LIMIT = 512

/** Markup of a mailcow language value: its formatting kept, everything else removed. */
export function sanitizeLegacyHtml(html: string): string {
  const previous = legacyCache.get(html)
  if (previous !== undefined) {
    legacyCache.delete(html)
    legacyCache.set(html, previous)
    return previous
  }
  const sanitized = legacyPurify.sanitize(defangForParsing(html), {
    ALLOWED_TAGS: LEGACY_TAGS,
    ALLOWED_ATTR: ['href', 'target'],
    ALLOWED_URI_REGEXP: LEGACY_URI,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_TRUSTED_TYPE: false,
  })
  if (html.length <= LEGACY_CACHE_INPUT_LIMIT) {
    if (legacyCache.size >= LEGACY_CACHE_LIMIT) {
      const oldest = legacyCache.keys().next().value
      if (oldest !== undefined) legacyCache.delete(oldest)
    }
    legacyCache.set(html, sanitized)
  }
  return sanitized
}

export type SanitizeRemoval = (typeof purify.removed)[number]

export function sanitizeHtml(
  html: string,
  report?: (removed: readonly SanitizeRemoval[]) => void,
): string {
  const safe = purify.sanitize(defangForParsing(html), {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href'],
    // Only absolute http(s) and mailto links: relative links and every other scheme are dropped.
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_TRUSTED_TYPE: false,
  })
  report?.(purify.removed)
  return safe
}

// UI 011 (research R9, FR-028, research R22): sanitisers that only a lazily loaded screen needs
// register here when their module loads, so that the shell does not carry them. `SanitizedHtml`
// uses a registered profile, and falls back to the strict operator profile while it is missing.
export type HtmlSanitizer = (html: string) => string

const profiles = new Map<string, HtmlSanitizer>()

export function registerSanitizer(profile: string, sanitize: HtmlSanitizer): void {
  profiles.set(profile, sanitize)
}

export function registeredSanitizer(profile: string): HtmlSanitizer | undefined {
  return profiles.get(profile)
}
