// The DKIM section of the domain and alias domain pages (T035, FR-021, research R19): the key's
// state, selector, length and record with copy buttons, a link to the entry, "no key" for a name
// without one, the incomplete notice, and the domain's link to its DKIM keys and alias domains.
import { flushPromises } from '@vue/test-utils'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent } from 'vue'

import { queryKeys, type DkimKey, type Identity } from '@/api'
import DomainDkimSection from '@/features/dns/components/DomainDkimSection.vue'

import { server } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'
import { aliasEntry, dkimEntry, dnsCapabilities, incompleteEntry, missingEntry } from './fixtures'

const Stub = defineComponent({ render: () => null })
const router = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Stub },
      { path: '/dns/dkim-keys', name: 'dkim-keys', component: Stub },
      { path: '/dns/dkim-keys/:dkimName', name: 'dkim-key', component: Stub },
    ],
  })

function serve(entry: DkimKey) {
  server.use(
    http.get('*/api/v2/dkim-keys/:name', () => HttpResponse.json({ data: entry })),
    http.get('*/api/v2/capabilities/dns', () => HttpResponse.json({ data: dnsCapabilities() })),
  )
  testPlugins().queryClient.setQueryData(queryKeys.identity(), {
    username: 'admin',
    role: 'admin',
  } as Identity)
}

async function mountSection(entry: DkimKey, kind: 'domain' | 'aliasDomain' = 'domain') {
  serve(entry)
  const wrapper = mountWithApp(DomainDkimSection, {
    props: { name: entry.name, kind },
    global: { plugins: [router()] },
  })
  await flushPromises()
  await flushPromises()
  return wrapper
}

describe('DomainDkimSection', () => {
  it('shows a valid key with the classic line, the record, the entry link and the list link', async () => {
    const wrapper = await mountSection(dkimEntry())
    expect(wrapper.get('h2').text()).toBe('ARC/DKIM keys')
    expect(wrapper.text()).toContain('Key valid')
    expect(wrapper.text()).toContain('Domain: example.org (dkim._domainkey)')
    expect(wrapper.text()).toContain('2,048')
    expect(wrapper.text()).toContain('v=DKIM1;k=rsa')
    const links = wrapper.findAll('a').map((a) => a.attributes('href'))
    expect(links).toContain('/dns/dkim-keys/example.org')
    expect(links).toContain('/dns/dkim-keys?domain=example.org')
  })

  it('says that a name without a key is not signed', async () => {
    const wrapper = await mountSection(missingEntry())
    expect(wrapper.text()).toContain('Key missing')
    expect(wrapper.text()).toContain('not signed')
  })

  it('explains an incomplete key', async () => {
    const wrapper = await mountSection(incompleteEntry())
    expect(wrapper.text()).toContain('Incomplete')
    expect(wrapper.text()).toContain('public key')
  })

  it('offers no list link on an alias domain', async () => {
    const wrapper = await mountSection(aliasEntry(), 'aliasDomain')
    const links = wrapper.findAll('a').map((a) => a.attributes('href'))
    expect(links).toContain('/dns/dkim-keys/example.com')
    expect(links.some((href) => href?.includes('?domain='))).toBe(false)
  })
})
