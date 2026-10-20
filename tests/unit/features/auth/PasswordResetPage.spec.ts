import { afterEach, expect, it, vi } from 'vitest'

import { createQueryClient } from '@/api'
import { setSessionContext } from '@/app/session/context'
import { sessionQuery } from '@/app/session/queries'
import PasswordResetPage from '@/features/auth/pages/PasswordResetPage.vue'
import { captureResetToken, takeResetToken } from '@/features/auth/reset-token'
import { createAppChannel } from '@/shared/platform/broadcast'

import { useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'
import { createTestRouter } from '../../support/router'

afterEach(() => {
  takeResetToken()
  setSessionContext(null)
})

it('US3-AS4 names the account and shows relative and absolute expiry above the password fields', async () => {
  useScenario('account-password-reset')
  const queryClient = createQueryClient({ retryDelay: 0 })
  const router = createTestRouter()
  setSessionContext({ queryClient, router, channel: createAppChannel('reset-page') })
  await queryClient.fetchQuery(sessionQuery())
  captureResetToken({
    path: '/reset-password',
    query: {},
    hash: '#token=3F9A1C-0B7E22-9D4F10-A6C3E8-51B2D7',
  } as never)
  const wrapper = mountWithApp(PasswordResetPage, { global: { plugins: [router] } })
  await vi.waitFor(() => expect(wrapper.find('[data-reset-password]').exists()).toBe(true))
  expect(wrapper.get('[data-reset-account]').text()).toContain('carl@example.org')
  const expiry = wrapper.get('[data-reset-expiry]')
  expect(expiry.text()).toContain('Expire in')
  expect(expiry.text()).toContain('15 minutes')
  expect(expiry.get('time').attributes('datetime')).toMatch(/^\d{4}-\d\d-\d\dT/)
  expect(expiry.get('time').text()).not.toBe('')
})
