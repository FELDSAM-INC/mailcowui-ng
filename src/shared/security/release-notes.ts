// Release notes (UI 011): imported by the release-notes renderer only, a lazy chunk, so the shell
// never carries this profile. It registers itself with `SanitizedHtml` (`profile="releaseNotes"`).
// UI 011 (research R9, FR-028): release notes, externally authored Markdown rendered to HTML by the
// release-notes renderer. Formatting, lists, code, quotes, tables and links are kept; images,
// styles, classes, handlers, frames, forms and every link other than http(s) and mailto are
// removed, so displaying the notes makes no request. Each link opens in a new window, without
// access to the app, and says so to screen reader users.
import DOMPurify from 'dompurify'

import { text } from '@/i18n'

import { defangForParsing, registerSanitizer } from './sanitize'

const RELEASE_NOTES_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'del',
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
  'code',
  'pre',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'hr',
]

const releaseNotesPurify = DOMPurify(window)

export function sanitizeReleaseNotes(html: string, opensInNewWindow: string): string {
  const fragment = releaseNotesPurify.sanitize(defangForParsing(html), {
    ALLOWED_TAGS: RELEASE_NOTES_TAGS,
    ALLOWED_ATTR: ['href', 'align'],
    // `align` is not a URI: without this, DOMPurify checks its value against the URI pattern.
    ADD_URI_SAFE_ATTR: ['align'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  })
  for (const link of fragment.querySelectorAll('a')) {
    if (!link.hasAttribute('href')) continue
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener noreferrer nofollow')
    const hint = document.createElement('span')
    hint.className = 'sr-only'
    hint.textContent = ` ${opensInNewWindow}`
    link.append(hint)
  }
  const holder = document.createElement('div')
  holder.append(fragment)
  return holder.innerHTML
}

registerSanitizer('releaseNotes', (html) =>
  sanitizeReleaseNotes(html, text('common.opensInNewTab')),
)
