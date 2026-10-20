import { nextTick, defineComponent } from 'vue'
import { expect, it } from 'vitest'
import { queryKeys } from '@/api'
import { identityQuery } from '@/app/session/queries'
import { useActingState } from '@/features/acting/composables/useActingState'
import { startImpersonation } from '@/features/acting/api'
import { mountWithApp, testPlugins } from '../../support/mount'
import { useScenario } from '../../../mocks/node'

it('derives acting information from identity changes without keeping a second identity copy', async () => {
  useScenario('acting-admin')
  const { queryClient } = testPlugins()
  const original = await queryClient.fetchQuery(identityQuery())
  const wrapper = mountWithApp(
    defineComponent({
      setup: useActingState,
      template:
        '<div>{{ isActing }} {{ target?.username }} {{ impersonator?.username }} {{ startedAt }}</div>',
    }),
  )
  expect(wrapper.text()).toBe('false')
  const started = await startImpersonation({ role: 'mailboxUser', username: 'alice@example.org' })
  queryClient.setQueryData(queryKeys.identity(), started.identity)
  await nextTick()
  expect(wrapper.text()).toBe(`true alice@example.org admin ${started.startedAt}`)
  queryClient.setQueryData(queryKeys.identity(), original)
  await nextTick()
  expect(wrapper.text()).toBe('false')
})
