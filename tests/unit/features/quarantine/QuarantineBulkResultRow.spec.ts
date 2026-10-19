import { describe, expect, it } from 'vitest'

import { fetchQuarantineItems } from '@/features/quarantine/api'
import QuarantineBulkResultRow from '@/features/quarantine/components/bulk/QuarantineBulkResultRow.vue'

import { useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

describe('QuarantineBulkResultRow', () => {
  it('shows delivery success alongside learning failure and renders report text inertly', async () => {
    useScenario('quarantine-mailbox-user')
    const [item] = (await fetchQuarantineItems({ limit: 25 })).data
    const wrapper = mountWithApp(QuarantineBulkResultRow, {
      props: {
        item,
        lines: [
          { kind: 'success', text: 'Item 30 released' },
          { kind: 'danger', text: '<script>alert(1)</script>' },
        ],
      },
    })
    expect(wrapper.get('[data-alert="success"]').text()).toBe('Item 30 released')
    expect(wrapper.get('[data-alert="danger"]').text()).toBe('<script>alert(1)</script>')
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.text()).toContain(item!.recipient)
    wrapper.unmount()
  })
})
