// Addresses and file names of UI 010 (T012, data-model §5, research R2, R13): every location is
// built from the API's `name`, so readable, upper-case, unused and slash-containing names
// round-trip through the router; file names are made safe.
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import {
  diagnosticsLocation,
  dkimCopyLocation,
  dkimImportLocation,
  dkimKeyLocation,
  dkimListLocation,
  privateKeyFileName,
  safeFileName,
  zoneFileName,
} from '@/features/dns/names'
const Stub = defineComponent({ render: () => null })

/** The paths of data-model §5, with stub pages. */
function router() {
  return createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [
      { path: '/dns', redirect: { name: 'dkim-keys' } },
      { path: '/dns/dkim-keys', name: 'dkim-keys', component: Stub },
      { path: '/dns/dkim-import', name: 'dkim-import', component: Stub },
      { path: '/dns/dkim-keys/:dkimName', name: 'dkim-key', component: Stub },
      { path: '/dns/dkim-keys/:dkimName/copy', name: 'dkim-copy', component: Stub },
      { path: '/dns/diagnostics/:diagnosticsName', name: 'dns-diagnostics', component: Stub },
    ],
  })
}

describe('DNS locations', () => {
  it.each(['example.org', 'xn--bcher-kva.example', 'Legacy.Example', 'odd/name.example'])(
    'round-trips %s through the entry, copy and diagnostics routes',
    async (name) => {
      const r = router()
      for (const [location, param] of [
        [dkimKeyLocation(name), 'dkimName'],
        [dkimCopyLocation(name), 'dkimName'],
        [diagnosticsLocation(name), 'diagnosticsName'],
      ] as const) {
        const path = r.resolve(location).fullPath
        await r.push(path)
        expect(r.currentRoute.value.params[param]).toBe(name)
      }
    },
  )

  it('builds the entry, copy, import, list and diagnostics locations', async () => {
    const r = router()
    expect(r.resolve(dkimKeyLocation('example.org')).path).toBe('/dns/dkim-keys/example.org')
    expect(r.resolve(dkimCopyLocation('example.org')).path).toBe('/dns/dkim-keys/example.org/copy')
    expect(r.resolve(diagnosticsLocation('example.org')).path).toBe('/dns/diagnostics/example.org')
    expect(r.resolve(dkimImportLocation()).fullPath).toBe('/dns/dkim-import')
    expect(r.resolve(dkimImportLocation('example.org')).fullPath).toBe(
      '/dns/dkim-import?name=example.org',
    )
    expect(r.resolve(dkimListLocation({ domain: 'example.org' })).fullPath).toBe(
      '/dns/dkim-keys?domain=example.org',
    )
    await r.push('/dns')
    expect(r.currentRoute.value.name).toBe('dkim-keys')
  })
})

describe('DNS file names', () => {
  it('replaces every character outside [A-Za-z0-9._-] with an underscore', () => {
    expect(safeFileName('example.org')).toBe('example.org')
    expect(safeFileName('odd/name ä*.example')).toBe('odd_name___.example')
    expect(safeFileName('Legacy.Example')).toBe('Legacy.Example')
  })

  it('names zone files and private keys', () => {
    expect(zoneFileName('example.org')).toBe('example.org.txt')
    expect(privateKeyFileName('dkim', 'example.org')).toBe('dkim.example.org.pem')
    expect(privateKeyFileName('a b', 'x/y')).toBe('a_b.x_y.pem')
  })
})
