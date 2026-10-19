// mailcow's language files in the mock (constitution IV 1.3.0): the upstream en-gb snapshot and the
// cs-cz and sk-sk fixtures, 404 for other languages, and the scenario switches for an unreachable
// `/lang/` and for an installation's own wording.
import { describe, expect, it } from 'vitest'

import snapshot from '@/i18n/snapshot/lang.en-gb.json'

import { useScenario } from '../../mocks/node'

const lang = (code: string) => fetch(`${location.origin}/lang/lang.${code}.json`)
// Reads the body as well: an unread mocked body makes Node 24's fetch fail when its socket closes.
const statusOf = async (response: Promise<Response>) => {
  const settled = await response
  await settled.arrayBuffer()
  return settled.status
}

describe('mock /lang/ files', () => {
  it('serves the snapshot as en-gb and the Czech and Slovak fixtures', async () => {
    const en = await lang('en-gb')
    expect(en.status).toBe(200)
    expect(en.headers.get('content-type')).toBe('application/json')
    expect(await en.json()).toEqual(snapshot)
    const cs = (await (await lang('cs-cz')).json()) as { login: Record<string, string> }
    expect(cs.login.password).toBe('Heslo')
    expect(await statusOf(lang('sk-sk'))).toBe(200)
  })

  it('answers 404 for a language without a file and for other names', async () => {
    expect(await statusOf(lang('de-de'))).toBe(404)
    expect(await statusOf(fetch(`${location.origin}/lang/other.json`))).toBe(404)
  })

  it('fails every file when the scenario makes /lang/ unavailable', async () => {
    useScenario('anonymous-default', { behaviour: { langUnavailable: true } })
    expect(await statusOf(lang('en-gb'))).toBe(503)
  })

  it("merges an installation's own wording over the file", async () => {
    useScenario('anonymous-default', {
      behaviour: { langPatch: { 'cs-cz': { login: { login: 'Vstoupit' } } } },
    })
    const cs = (await (await lang('cs-cz')).json()) as { login: Record<string, string> }
    expect(cs.login.login).toBe('Vstoupit')
    expect(cs.login.password).toBe('Heslo')
  })
})
