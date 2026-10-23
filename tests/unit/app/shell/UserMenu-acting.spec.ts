import { expect, it } from 'vitest'
import { identityQuery } from '@/app/session/queries'
import UserMenu from '@/app/shell/UserMenu.vue'
import { startImpersonation } from '@/features/acting/api'
import { mountWithApp, testPlugins } from '../../support/mount'
import { useScenario } from '../../../mocks/node'

it.each([false, true])(
  'calls the existing sign-out action with the acting=%s label',
  async (acting) => {
    useScenario('acting-admin')
    const identity = acting
      ? (await startImpersonation({ role: 'mailboxUser', username: 'alice@example.org' })).identity
      : await testPlugins().queryClient.fetchQuery(identityQuery())
    const wrapper = mountWithApp(UserMenu, {
      props: { identity },
      global: {
        stubs: {
          DropdownMenu: { template: '<div><slot /></div>' },
          DropdownMenuContent: { template: '<div><slot /></div>' },
          DropdownMenuItem: {
            emits: ['select'],
            template: '<button @click="$emit(\'select\')"><slot /></button>',
          },
          DropdownMenuTrigger: { template: '<button><slot /></button>' },
          DropdownMenuLabel: { template: '<div><slot /></div>' },
          DropdownMenuSeparator: true,
        },
      },
    })
    const button = wrapper
      .findAll('button')
      .find((item) => item.text() === (acting ? 'Sign out completely' : 'Sign out'))!
    expect(button).toBeDefined()
    await button.trigger('click')
    expect(wrapper.emitted('signOut')).toHaveLength(1)
  },
)
