// The diagnostics summary (T057, FR-062, SC-008): the counts per group, the attention filter and
// "all required records are correct" with the number not verified.
import { describe, expect, it } from 'vitest'

import DiagnosticsSummary from '@/features/dns/components/DiagnosticsSummary.vue'

import { mountWithApp } from '../../support/mount'
import { checkOfStatus } from './diagnostics-fixtures'

describe('DiagnosticsSummary', () => {
  it('counts every group and toggles the attention filter', async () => {
    const checks = [
      checkOfStatus('match'),
      checkOfStatus('match'),
      checkOfStatus('mismatch'),
      checkOfStatus('missing', true),
      checkOfStatus('lookupFailed'),
    ]
    const wrapper = mountWithApp(DiagnosticsSummary, {
      props: { checks, onlyAttention: false },
    })
    const text = wrapper.text()
    expect(text).toContain('2 correct')
    expect(text).toContain('1 need attention')
    expect(text).toContain('1 optional, not set')
    expect(text).toContain('1 not verified')
    expect(text).not.toContain('All required records')
    await wrapper.get('input[type="checkbox"]').setValue(true)
    expect(wrapper.emitted('update:onlyAttention')?.[0]).toEqual([true])
  })

  it('says that all required records are correct, with the number not verified', () => {
    const fine = mountWithApp(DiagnosticsSummary, {
      props: { checks: [checkOfStatus('match')], onlyAttention: false },
    })
    expect(fine.text()).toContain('All required records are correct.')
    const partly = mountWithApp(DiagnosticsSummary, {
      props: {
        checks: [checkOfStatus('match'), checkOfStatus('expectedUnknown')],
        onlyAttention: false,
      },
    })
    expect(partly.text()).toContain('could be checked are correct; 1 not verified')
  })
})
