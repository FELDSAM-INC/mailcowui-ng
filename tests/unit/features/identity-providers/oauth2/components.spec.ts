// OAuth2 components and the quick actions (T082): the card's classic values, the table's sortable
// headers, stored URIs marked with their rule, and the bulk composable's outcomes, including a lost
// connection and a refused request.
import { flushPromises } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import type { Oauth2Client } from '@/api'
import { lt } from '@/i18n'
import ClientIdList from '@/features/identity-providers/oauth2/components/ClientIdList.vue'
import Oauth2ClientCard from '@/features/identity-providers/oauth2/components/Oauth2ClientCard.vue'
import Oauth2ClientTable from '@/features/identity-providers/oauth2/components/Oauth2ClientTable.vue'
import RedirectUriList from '@/features/identity-providers/oauth2/components/RedirectUriList.vue'
import { useOauth2Bulk } from '@/features/identity-providers/oauth2/composables/useOauth2Bulk'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'

import { server, useScenario } from '../../../../mocks/node'
import { mountWithApp, resetTestPlugins } from '../../../support/mount'
import { createTestRouter } from '../../../support/router'

afterEach(() => {
  settleConfirm(false)
  resetTestPlugins()
})

const client = (
  id: number,
  uris: string[] = [`https://app${id}.example.org/cb`],
): Oauth2Client => ({
  id,
  clientId: `a1b2c300000${id}`,
  redirectUris: uris,
  scope: 'profile',
  activeAccessTokens: 0,
  activeRefreshTokens: 0,
  etag: `"o${id}"`,
})

describe('OAuth2 components', () => {
  it('shows a card with the client ID heading, the ID and every redirect URI as text', () => {
    const wrapper = mountWithApp(Oauth2ClientCard, {
      props: { client: client(3, ['https://a.example/cb', 'com.example.app:/cb']) },
      global: { plugins: [createTestRouter()] },
    })
    expect(wrapper.get('h3').text()).toBe('a1b2c3000003')
    expect(wrapper.text()).toContain(lt('admin.oauth2_redirect_uri'))
    expect(wrapper.findAll('li li')).toHaveLength(2)
    expect(wrapper.find('a[href*="https://a.example"]').exists()).toBe(false)
  })

  it('marks stored redirect URIs that break the rules, and shows an empty list as a dash', () => {
    const marked = mountWithApp(RedirectUriList, {
      props: { uris: ['https://ok.example/cb', 'https://x.example/#frag'], marks: true },
    })
    expect(marked.findAll('[data-invalid-uri]')).toHaveLength(1)
    const empty = mountWithApp(RedirectUriList, { props: { uris: [] } })
    expect(empty.text()).toBe('—')
  })

  it('lists the client IDs a confirmation affects', () => {
    const wrapper = mountWithApp(ClientIdList, { props: { clientIds: ['aaa', 'bbb'] } })
    expect(wrapper.findAll('li').map((li) => li.text())).toEqual(['aaa', 'bbb'])
  })

  it('sorts from the table headers with aria-sort', async () => {
    const wrapper = mountWithApp(Oauth2ClientTable, {
      props: { clients: [client(1)], sort: 'id', order: 'asc' },
      global: { plugins: [createTestRouter()] },
    })
    expect(wrapper.findAll('th[aria-sort="none"]')).toHaveLength(2)
    await wrapper.findAll('th button')[0]!.trigger('click')
    await wrapper.findAll('th button')[2]!.trigger('click')
    expect(wrapper.emitted('sort')).toEqual([
      ['id', 'desc'],
      ['redirectUri', 'asc'],
    ])
  })
})

function bulkHarness(entries: Oauth2Client[]) {
  let api!: ReturnType<typeof useOauth2Bulk>
  let selection!: ReturnType<typeof useBulkSelection>
  const Harness = defineComponent({
    setup() {
      selection = useBulkSelection()
      api = useOauth2Bulk({ selection, entries: () => entries })
      return () => h('div')
    },
  })
  mountWithApp(Harness)
  return { bulk: () => api, selection: () => selection }
}

describe('useOauth2Bulk', () => {
  it('reports every client as "outcome unknown" when the connection drops, and clears the selection', async () => {
    useScenario('oauth2-bulk-partial')
    server.use(http.post('*/api/v2/oauth2-clients/bulk-actions', () => HttpResponse.error()))
    const { bulk, selection } = bulkHarness([client(1), client(2)])
    selection().enter()
    selection().selectPage(['1', '2'])
    const done = bulk().run('revokeTokens')
    await vi.waitFor(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(true)
    await done
    expect(bulk().rows.value.map((row) => row.outcome)).toEqual(['unknown', 'unknown'])
    expect(selection().count.value).toBe(0)
  })

  it('shows a refusal of the whole request as a problem, and does nothing without a selection', async () => {
    useScenario('oauth2-bulk-partial', {
      failures: { bulkOauth2ClientAction: { status: 403, type: 'forbidden' } },
    })
    const { bulk, selection } = bulkHarness([client(1)])
    await bulk().run('delete')
    expect(confirmState.value).toBeNull()
    selection().selectPage(['1'])
    const done = bulk().run('delete')
    await vi.waitFor(() => expect(confirmState.value?.requireTyped?.accepted).toEqual(['1']))
    settleConfirm(true)
    await done
    await nextTick()
    expect(bulk().problem.value?.status).toBe(403)
    bulk().close()
    expect(bulk().phase.value).toBe('idle')
    await flushPromises()
  })
})
