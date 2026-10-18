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

export async function attachCspRecorder(context: BrowserContext): Promise<CspRecorder> {
  const violations: CspViolation[] = []
  await context.exposeBinding('__mailcowuiNgCsp', (_source, violation: CspViolation) => {
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
