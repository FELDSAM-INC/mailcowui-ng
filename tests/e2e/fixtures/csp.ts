// CSP violation detection (research R18, R24): a `securitypolicyviolation` listener in every page
// of the context, plus console errors that report a blocked resource. Any event fails the test.
import type { BrowserContext } from '@playwright/test'

export interface CspViolation {
  directive: string
  blockedURI: string
  sample: string
  source: string
}

export interface CspRecorder {
  list(): CspViolation[]
}

declare global {
  interface Window {
    __mailcowuiNgCsp?: (violation: CspViolation) => void
  }
}

/**
 * WebKit's test build styles native form controls such as `<select>` with its own user-agent
 * styles and reports them against the page's CSP as `style-src-elem` and `style-src-attr`
 * violations, attributed to the inspector bootstrap (`web-inspector://bootstrap.js`) or to the
 * script that created the element, although no page style is involved (measured: a bare
 * `<select>` added to a page triggers them). On WebKit those two directives are therefore ignored,
 * and so is its console, which repeats the reports without a source. The Chromium projects check
 * the same build against the same policy, so an inline style of the app still fails there.
 */
const BROWSER_INTERNAL = /^web-inspector:\/\//
const WEBKIT_UA_STYLE_DIRECTIVES = new Set(['style-src-elem', 'style-src-attr'])

export async function attachCspRecorder(context: BrowserContext): Promise<CspRecorder> {
  const violations: CspViolation[] = []
  const webkit = context.browser()?.browserType().name() === 'webkit'
  await context.exposeBinding('__mailcowuiNgCsp', (_source, violation: CspViolation) => {
    if (BROWSER_INTERNAL.test(violation.source)) return
    if (webkit && WEBKIT_UA_STYLE_DIRECTIVES.has(violation.directive)) return
    violations.push(violation)
  })
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__mailcowuiNgCsp?.({
        directive: event.effectiveDirective || event.violatedDirective,
        blockedURI: event.blockedURI,
        sample: event.sample,
        source: `${event.sourceFile}:${event.lineNumber}`,
      })
    })
  })
  context.on('console', (message) => {
    if (webkit) return
    if (
      message.type() === 'error' &&
      /Content Security Policy|Refused to (load|apply|execute)/i.test(message.text())
    ) {
      violations.push({
        directive: 'console',
        blockedURI: '',
        sample: message.text(),
        source: message.location().url,
      })
    }
  })
  return { list: () => violations }
}
