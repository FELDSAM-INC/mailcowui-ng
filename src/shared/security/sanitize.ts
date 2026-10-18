// Sanitiser for operator-authored HTML: the login help text and the footer (FR-002, research R17).
// The output may only be rendered through SanitizedHtml.vue, the one place that uses v-html.
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

export function sanitizeHtml(html: string): string {
  return purify.sanitize(defangForParsing(html), {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href'],
    // Only absolute http(s) and mailto links: relative links and every other scheme are dropped.
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_TRUSTED_TYPE: false,
  })
}
