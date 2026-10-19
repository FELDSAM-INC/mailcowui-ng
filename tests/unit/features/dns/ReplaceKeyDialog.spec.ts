// Replacing a key with a new one (T080, research R10, FR-090): the generation fields with a hint
// to choose a selector other than the current one.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ReplaceKeyDialog from '@/features/dns/components/ReplaceKeyDialog.vue'

import { mountWithApp } from '../../support/mount'
import { dkimEntry, dnsCapabilities } from './fixtures'

describe('ReplaceKeyDialog', () => {
  it('recommends a selector other than the current one', async () => {
    const wrapper = mountWithApp(ReplaceKeyDialog, {
      props: { open: true, entry: dkimEntry(), caps: dnsCapabilities() },
      attachTo: document.body,
    })
    await flushPromises()
    expect(document.body.textContent).toContain('Replace with a new key')
    expect(document.body.querySelector('[data-generate-hint]')?.textContent).toContain('dkim')
    const form = document.body.querySelector('form')!
    form.dispatchEvent(new Event('submit', { cancelable: true }))
    await flushPromises()
    expect(wrapper.emitted('submit')?.[0]).toEqual([{ selector: 'dkim', keySize: 2048 }])
    wrapper.unmount()
  })
})
