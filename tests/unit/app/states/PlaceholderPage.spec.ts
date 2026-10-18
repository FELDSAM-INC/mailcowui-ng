// T095: placeholders (FR-044): the section name, "comes in a later version", the classic pages of
// the role, the note about the separate classic sign-in, and no request at all.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { queryKeys, type Identity, type Role } from '@/api'
import PlaceholderPage from '@/app/states/PlaceholderPage.vue'

import { mockState } from '../../../mocks/node'
import { permissionFlags } from '../../../mocks/scenarios/accounts'
import { mountWithApp, testPlugins } from '../../support/mount'

async function mountPlaceholder(entryId: string, role: Role) {
  testPlugins().queryClient.setQueryData(queryKeys.identity(), {
    username: 'someone',
    role,
    authentication: { method: 'password' },
    scope: { type: 'allDomains' },
    permissions: permissionFlags(true),
    pendingActions: [],
  } as unknown as Identity)
  const wrapper = mountWithApp(PlaceholderPage, { props: { entryId } })
  await flushPromises()
  return wrapper
}

const links = (wrapper: Awaited<ReturnType<typeof mountPlaceholder>>) =>
  wrapper.findAll('a').map((a) => [a.text(), a.attributes('href')])

describe('PlaceholderPage', () => {
  it('names the section and says that it comes later', async () => {
    const wrapper = await mountPlaceholder('domains', 'admin')
    expect(wrapper.get('h1').text()).toBe('Domains')
    expect(wrapper.text()).toContain('This section comes in a later version of the app.')
  })

  it('links to the classic pages of the role', async () => {
    expect(links(await mountPlaceholder('domains', 'admin'))).toEqual([
      ['Mail setup', '/admin/mailbox'],
    ])
    expect(links(await mountPlaceholder('domains', 'domainAdmin'))).toEqual([
      ['Mail setup', '/domainadmin/mailbox'],
    ])
    expect(links(await mountPlaceholder('account', 'mailboxUser'))).toEqual([
      ['User settings', '/user'],
    ])
    expect(links(await mountPlaceholder('routing', 'admin'))).toEqual([
      ['Configuration', '/admin/system'],
      ['Mail setup', '/admin/mailbox'],
    ])
  })

  it('notes that the classic interface needs its own sign-in', async () => {
    const wrapper = await mountPlaceholder('quarantine', 'mailboxUser')
    expect(wrapper.text()).toContain(
      'The classic interface has its own session, so you sign in there separately.',
    )
  })

  it('requests no data', async () => {
    await mountPlaceholder('dns', 'admin')
    expect(mockState().requests).toEqual([])
  })
})
