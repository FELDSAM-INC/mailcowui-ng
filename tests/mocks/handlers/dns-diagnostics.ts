// DNS diagnostics handler (UI 010 T007, T052): a run of a domain or alias domain in the caller's
// scope from the scenario's template (or the default one), server-wide checks for administrators
// only, `RateLimit-*` and `Cache-Control: no-store` on every result, and `429 too-many-requests`
// with `Retry-After` and the `RateLimit-*` headers after the scenario caller's runs per minute.
import { findEntry } from '../factories/dkim-key'
import { defaultTemplate, diagnosticsResult } from '../factories/dns-diagnostics'
import type { ScenarioState } from '../scenarios/state'
import { http, problem, scenario } from './context'
import { notFound, requireManager } from './domain-rules'

const WINDOW_MS = 60_000

/** Takes one run from the window; null when none is left. */
function takeRun(state: ScenarioState): { limit: number; remaining: number; reset: number } | null {
  const limit = state.dns.rateLimit
  const now = state.now()
  if (now - limit.windowStartedAt >= WINDOW_MS) {
    limit.windowStartedAt = now
    limit.remaining = limit.limit
  }
  const reset = Math.max(0, Math.ceil((limit.windowStartedAt + WINDOW_MS - now) / 1000))
  if (limit.remaining <= 0) return null
  limit.remaining -= 1
  return { limit: limit.limit, remaining: limit.remaining, reset }
}

function rateHeaders(state: ScenarioState, remaining: number, reset: number) {
  return {
    'RateLimit-Limit': String(state.dns.rateLimit.limit),
    'RateLimit-Remaining': String(remaining),
    'RateLimit-Reset': String(reset),
  }
}

export const dnsDiagnosticsHandlers = [
  http.get('/dns-diagnostics/{diagnosticsName}', ({ params, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const entry = findEntry(state, account, params.diagnosticsName)
    if (!entry || entry.kind === 'none') return response.untyped(notFound())
    const run = takeRun(state)
    if (!run) {
      const now = state.now()
      const retryAfter = Math.max(
        1,
        Math.ceil((state.dns.rateLimit.windowStartedAt + WINDOW_MS - now) / 1000),
      )
      return response.untyped(
        problem(
          429,
          'too-many-requests',
          { retryAfter },
          { 'Retry-After': String(retryAfter), ...rateHeaders(state, 0, retryAfter) },
        ),
      )
    }
    const template = state.dns.diagnostics[entry.name] ?? defaultTemplate(state, entry.name)
    const data = diagnosticsResult(state, entry.name, template, account.role)
    return response(200).json(
      { data },
      {
        headers: {
          ...rateHeaders(state, run.remaining, run.reset),
          'Cache-Control': 'no-store',
        },
      },
    )
  }),
]
