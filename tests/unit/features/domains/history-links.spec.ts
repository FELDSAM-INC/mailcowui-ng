// The History links of UI 002 US8 (T098, T101, FR-063, research D26): the domain page offers the
// domain's history only to whoever may open the audit log (administrators), the template page
// opens the template's records and the API key page the key's records.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { setSessionContext } from '@/app/session/context'
import ApiKeyDetailPage from '@/features/api-keys/pages/ApiKeyDetailPage.vue'
import DomainDetailPage from '@/features/domains/pages/DomainDetailPage.vue'
import TemplateDetailPage from '@/features/domains/pages/TemplateDetailPage.vue'
import { createAppChannel } from '@/shared/platform/broadcast'

import { useScenario } from '../../../mocks/node'
import { HISTORY_KEY } from '../../../mocks/scenarios/domains-history'
import { mountWithApp, testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'

afterEach(() => setSessionContext(null))

async function mountAt(path: string, component: object, props: Record<string, unknown> = {}) {
  const router = createTestRouter()
  await router.push(path)
  setSessionContext({
    queryClient: testPlugins().queryClient,
    router,
    channel: createAppChannel('test'),
  })
  const wrapper = mountWithApp(component, {
    props,
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const historyHref = (wrapper: Awaited<ReturnType<typeof mountAt>>) =>
  wrapper
    .findAll('a')
    .find((link) => link.text() === 'History')
    ?.attributes('href')

describe('History links', () => {
  it('the domain page offers the history of the domain by its ASCII name to administrators', async () => {
    useScenario('audit-domain-records')
    const wrapper = await mountAt('/domains/example.org', DomainDetailPage)
    await vi.waitFor(() => expect(historyHref(wrapper)).toBeDefined())
    expect(historyHref(wrapper)).toBe('/ng/audit-log?targetId=example.org')
  })

  it('the domain page offers no history to a domain administrator', async () => {
    useScenario('audit-domain-records-domain-admin')
    const wrapper = await mountAt('/domains/example.org', DomainDetailPage)
    await vi.waitFor(() => expect(wrapper.text()).toContain('example.org'))
    await flushPromises()
    expect(historyHref(wrapper)).toBeUndefined()
  })

  it('the template page opens the records of the template', async () => {
    useScenario('audit-domain-records')
    const wrapper = await mountAt('/domain-templates/2', TemplateDetailPage)
    await vi.waitFor(() => expect(historyHref(wrapper)).toBeDefined())
    expect(historyHref(wrapper)).toBe('/ng/audit-log?targetType=domainTemplate&targetId=2')
  })

  it('the API key page opens the records of the key', async () => {
    useScenario('audit-domain-records')
    const wrapper = await mountAt(`/api-keys/${HISTORY_KEY.id}`, ApiKeyDetailPage, {
      apiKeyId: HISTORY_KEY.id,
    })
    await vi.waitFor(() => expect(historyHref(wrapper)).toBeDefined())
    expect(historyHref(wrapper)).toBe(`/ng/audit-log?targetType=apiKey&targetId=${HISTORY_KEY.id}`)
  })
})
