import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { ApiProblem } from '@/api'
import * as accountApi from '@/features/account/api/second-factors'
import YubicoOtpSetup from '@/features/account/components/two-factor/YubicoOtpSetup.vue'

import { useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

describe('Yubico enrolment failure feedback', () => {
  it.each([
    [429, 'too-many-requests', 'Too many attempts. Please wait before trying again.'],
    [422, 'validation-failed', 'Some fields need your attention.'],
    [0, '', 'The server could not be reached. Check your connection and try again.'],
  ] as const)(
    'shows the %s refusal without discarding the editable setup',
    async (status, type, message) => {
      useScenario('account-two-factor-empty')
      const failure =
        status === 0
          ? new TypeError('Offline')
          : ApiProblem.fromParts({ kind: 'problem', status, type: `/api/v2/problems/${type}` })
      const request = vi.spyOn(accountApi, 'enrolSecondFactor').mockRejectedValue(failure)
      const wrapper = mountWithApp(YubicoOtpSetup, { attachTo: document.body })
      const values = ['YubiKey', '12345', 'secret', 'Password-1', 'c'.repeat(44)]
      for (const [index, input] of wrapper.findAll('input').entries()) {
        await input.setValue(values[index]!)
      }
      await wrapper.get('form').trigger('submit')
      await flushPromises()
      expect(request).toHaveBeenCalledTimes(1)
      expect(wrapper.text()).toContain(message)
      expect(wrapper.find('form').exists()).toBe(true)
      expect(wrapper.emitted('done')).toBeUndefined()
    },
  )
})
