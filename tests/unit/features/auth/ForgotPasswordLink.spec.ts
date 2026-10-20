import { beforeEach, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import ForgotPasswordLink from '@/features/auth/components/ForgotPasswordLink.vue'

import { mountWithApp } from '../../support/mount'

const capabilities = vi.hoisted(() => ({
  data: { value: undefined as { passwordReset: { available: boolean } } | undefined },
  isPending: { value: false },
  isError: { value: false },
}))
vi.mock('@/shared/composables/useSelfServiceCapabilities', () => ({
  useSelfServiceCapabilities: () => capabilities,
}))

beforeEach(() => {
  capabilities.data.value = undefined
  capabilities.isPending.value = false
  capabilities.isError.value = false
})

function mountLink() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/reset-password/request',
        name: 'password-reset-request',
        component: { render: () => null },
      },
    ],
  })
  return mountWithApp(ForgotPasswordLink, { global: { plugins: [router] } })
}

it('FR-034 hides recovery until capabilities are known', () => {
  capabilities.isPending.value = true
  expect(mountLink().find('[data-forgot-password]').exists()).toBe(false)
})

it('FR-034 hides recovery when it is unavailable', () => {
  capabilities.data.value = { passwordReset: { available: false } }
  expect(mountLink().find('[data-forgot-password]').exists()).toBe(false)
})

it('FR-034 hides a previously available recovery link when its capabilities read fails', () => {
  capabilities.data.value = { passwordReset: { available: true } }
  capabilities.isError.value = true
  expect(mountLink().find('[data-forgot-password]').exists()).toBe(false)
})

it('FR-034 offers the in-app request when recovery is available', () => {
  capabilities.data.value = { passwordReset: { available: true } }
  expect(mountLink().get('[data-forgot-password]').attributes('href')).toBe(
    '/reset-password/request',
  )
})
