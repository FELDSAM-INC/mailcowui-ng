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

it('shows a supplied verification date and preserves zero-valued support', async () => {
  await loadFeatureMessages('system-settings')
  const wrapper = mountWithApp(LicenseResult, {
    props: {
      result: {
        result: 'valid',
        verifiedAt: '2026-10-20T10:00:00Z',
        customerId: 'customer-123',
        serviceId: 'service-456',
        supportLevel: 0,
      },
    },
  })
  expect(wrapper.get('time').attributes('datetime')).toBe('2026-10-20T10:00:00Z')
  expect(wrapper.get('time').text()).toMatch(/2026/)
  expect(wrapper.findAll('dl > div').map((row) => row.get('dd').text())).toEqual([
    'Valid',
    expect.stringMatching(/2026/),
    'customer-123',
    'service-456',
    '0',
  ])
  wrapper.unmount()
})
