import { expect, it } from 'vitest'
import { loadFeatureMessages } from '@/i18n'
import LicenseResult from '@/features/system-settings/components/integrations/LicenseResult.vue'
import { mountWithApp } from '../../support/mount'
it.each([
  ['valid', 'Valid'],
  ['invalid', 'Invalid'],
  ['unreachable', 'License service unreachable'],
  ['neverVerified', 'Never verified'],
] as const)('labels %s without implying a network error', async (result, label) => {
  await loadFeatureMessages('system-settings')
  const wrapper = mountWithApp(LicenseResult, {
    props: {
      result: { result, verifiedAt: null, customerId: null, serviceId: null, supportLevel: null },
    },
  })
  expect(wrapper.text()).toContain(label)
  expect(wrapper.find('time').exists()).toBe(false)
  expect(wrapper.find('[role=alert]').exists()).toBe(false)
})
