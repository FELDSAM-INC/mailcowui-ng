// Diagnostics checks as a table (T057, FR-068): the classic interface's four column headers, a row
// per check in the API's order with the purpose and record name, the expected value or guidance,
// and the status with the values found.
import { describe, expect, it } from 'vitest'

import DnsCheckTable from '@/features/dns/components/DnsCheckTable.vue'
import CopyButton from '@/shared/components/CopyButton.vue'

import { mountWithApp } from '../../support/mount'
import { check, checkOfStatus } from './diagnostics-fixtures'

describe('DnsCheckTable', () => {
  it('has the classic headers and one row per check in order', () => {
    const checks = [
      check(),
      check({ id: 'autoconfig', recordName: 'autoconfig.example.org', recordType: 'CNAME' }),
      checkOfStatus('lookupFailed'),
    ]
    const wrapper = mountWithApp(DnsCheckTable, {
      props: { checks, caption: 'Records of this name' },
    })
    expect(wrapper.findAll('thead th').map((th) => th.text())).toEqual([
      'Name',
      'Type',
      'Correct Data',
      'Current State',
    ])
    expect(wrapper.findAll('thead th').every((th) => th.attributes('scope') === 'col')).toBe(true)
    expect(wrapper.get('caption').text()).toBe('Records of this name')
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.get('th').text()).toContain('Mail exchanger')
    expect(rows[1]!.get('th').text()).toContain('Autoconfig')
    expect(rows[2]!.text()).toContain('Could not be checked')
    expect(rows[2]!.text()).toContain('The lookup timed out after 5 seconds.')
    expect(wrapper.findAllComponents(CopyButton).length).toBe(6)
  })
})
