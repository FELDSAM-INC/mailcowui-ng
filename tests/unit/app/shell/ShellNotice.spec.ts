import { expect, it } from 'vitest'
import { nextTick } from 'vue'
import ShellNotice from '@/app/shell/ShellNotice.vue'
import { useSessionStore } from '@/app/session/store'
import { mountWithApp } from '../../support/mount'
import { createTestRouter } from '../../support/router'
it('announces a refused write, is dismissible and clears on the next navigation', async () => {
  const router = createTestRouter()
  await router.push('/')
  const wrapper = mountWithApp(ShellNotice, { global: { plugins: [router] } })
  const store = useSessionStore()
  store.shellNotice = { key: 'acting.notice.changedInAnotherTab', refusedWrite: true }
  await nextTick()
  expect(wrapper.get('[role="alert"]').text()).toContain('Your last action was not carried out.')
  await wrapper.get('button').trigger('click')
  expect(store.shellNotice).toBeNull()
  store.shellNotice = { key: 'acting.notice.endedByServer', refusedWrite: true }
  await router.push('/domains')
  expect(store.shellNotice).toBeNull()
})
