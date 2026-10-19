// The zone file (T057, FR-067, SC-009): legacy's "Download" saving `<name>.txt` byte for byte, a
// copy button, and a view collapsed by default.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import ZoneFilePanel from '@/features/dns/components/DiagnosticsZoneFile.vue'
import * as download from '@/shared/platform/download'
import CopyButton from '@/shared/components/CopyButton.vue'

import { mountWithApp } from '../../support/mount'

const ZONE = '$ORIGIN example.org.\r\nexample.org.\tIN\tMX\t10 mail.example.org.\n'

describe('ZoneFilePanel', () => {
  it('is collapsed by default and shows the zone file when opened', async () => {
    const wrapper = mountWithApp(ZoneFilePanel, {
      props: { name: 'example.org', zoneFile: ZONE },
      attachTo: document.body,
    })
    const toggle = wrapper.get('[data-zone-toggle]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[data-zone-file]').exists()).toBe(false)
    await toggle.trigger('click')
    await flushPromises()
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[data-zone-file]').text()).toBe(ZONE.trim())
    expect(toggle.text()).toBe('Hide zone file')
    wrapper.unmount()
  })

  it('downloads <name>.txt with the exact text and copies the same text', async () => {
    const save = vi.spyOn(download, 'downloadText').mockImplementation(() => undefined)
    const wrapper = mountWithApp(ZoneFilePanel, {
      props: { name: 'odd/name.example', zoneFile: ZONE },
    })
    await wrapper.get('[data-zone-download]').trigger('click')
    expect(save).toHaveBeenCalledWith(ZONE, 'odd_name.example.txt', 'text/plain')
    expect(wrapper.get('[data-zone-download]').text()).toBe('Download')
    const copy = wrapper.getComponent(CopyButton)
    expect(copy.props('text')).toBe(ZONE)
    expect(copy.props('label')).toBe('Copy zone file')
  })
})
