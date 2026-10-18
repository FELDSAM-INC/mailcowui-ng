// mailcow's static language files, `/lang/lang.<code>.json`, which the app reads from the same
// origin (constitution I and IV 1.3.0). They are not part of the API contract, so they are served
// outside its validation: the upstream en-gb snapshot the app bundles and the upstream cs-cz and
// sk-sk files committed as fixtures (`scripts/i18n/refresh-snapshot.mjs`). Other languages answer
// 404, as an installation without that file would, so the app shows en-gb for them. The scenario
// behaviour `langUnavailable` makes every file fail, for the bundled-snapshot fallback, and
// `langPatch` changes texts as a fork or an operator would.
import { http, HttpResponse, type RequestHandler } from 'msw'

import enGb from '@/i18n/snapshot/lang.en-gb.json'

import csCz from '../../fixtures/lang/lang.cs-cz.json'
import skSk from '../../fixtures/lang/lang.sk-sk.json'
import type { ScenarioState } from '../scenarios/state'

type LangFile = Record<string, Record<string, unknown>>

const FILES: Record<string, LangFile> = { 'en-gb': enGb, 'cs-cz': csCz, 'sk-sk': skSk }

const contents = new Map<string, string>()

function content(code: string, patch: LangFile | undefined): string | null {
  const file = FILES[code]
  if (!file) return null
  if (patch) {
    const patched: LangFile = { ...file }
    for (const [section, values] of Object.entries(patch)) {
      patched[section] = { ...(patched[section] ?? {}), ...values }
    }
    return JSON.stringify(patched)
  }
  let text = contents.get(code)
  if (text === undefined) {
    text = JSON.stringify(file)
    contents.set(code, text)
  }
  return text
}

export function langHandlers(
  stateResolver: (request: Request) => ScenarioState | null,
): RequestHandler[] {
  return [
    http.get('*/lang/:file', ({ request, params }) => {
      const state = stateResolver(request)
      if (state?.behaviour.langUnavailable) {
        return new HttpResponse('<html>503 Service Unavailable</html>', {
          status: 503,
          headers: { 'Content-Type': 'text/html' },
        })
      }
      const code = /^lang\.([a-z]{2}-[a-z]{2})\.json$/.exec(String(params.file))?.[1]
      const body = code ? content(code, state?.behaviour.langPatch[code]) : null
      if (!body) {
        return new HttpResponse('<html>404 Not Found</html>', {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        })
      }
      return new HttpResponse(body, {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      })
    }),
  ]
}
