// The impact of deleting a DKIM key (T080, research R9, FR-037, FR-038): the name with its ASCII
// form, kind, selector and length; mail no longer signed for domains and alias domains; the private
// key deleted permanently; and the DNS record depending on the publication setting. In bulk: every
// key, the names whose mail stops being signed, and the skipped entries.
import { describe, expect, it } from 'vitest'

import BulkDeleteImpact from '@/features/dns/components/BulkDeleteImpact.vue'
import DeleteKeyImpact from '@/features/dns/components/DeleteKeyImpact.vue'

import { mountWithApp } from '../../support/mount'
import { aliasEntry, dkimEntry, missingEntry, unusedEntry } from './fixtures'

describe('DeleteKeyImpact', () => {
  it('names the key and says mail stops being signed, with publication off', () => {
    const wrapper = mountWithApp(DeleteKeyImpact, {
      props: {
        entry: dkimEntry({ name: 'xn--bcher-kva.example', displayName: 'bücher.example' }),
        publication: false,
      },
    })
    const text = wrapper.text()
    expect(text).toContain('bücher.example')
    expect(text).toContain('xn--bcher-kva.example')
    expect(text).toContain('Domain')
    expect(text).toContain('dkim')
    expect(text).toContain('2,048')
    expect(text).toContain('no longer signed')
    expect(text).toContain('deleted permanently')
    expect(text).toContain('stays in the DNS zone')
  })

  it('says the record is removed and recorded in the history with publication on', () => {
    const wrapper = mountWithApp(DeleteKeyImpact, {
      props: { entry: aliasEntry(), publication: true },
    })
    expect(wrapper.text()).toContain('Alias domain')
    expect(wrapper.text()).toContain('removed from the DNS zone')
    expect(wrapper.text()).toContain('history')
  })

  it('does not speak of signing for an unused key', () => {
    const wrapper = mountWithApp(DeleteKeyImpact, {
      props: { entry: unusedEntry(), publication: false },
    })
    expect(wrapper.text()).not.toContain('no longer signed')
  })
})

describe('BulkDeleteImpact', () => {
  it('lists every key, marks the signing names and lists the skipped ones', () => {
    const wrapper = mountWithApp(BulkDeleteImpact, {
      props: {
        targets: [dkimEntry(), aliasEntry(), unusedEntry()],
        skipped: [missingEntry()],
        publication: false,
      },
    })
    const items = wrapper.findAll('[data-delete-target]')
    expect(items).toHaveLength(3)
    expect(items[0]!.text()).toContain('example.org')
    expect(items[0]!.text()).toContain('dkim')
    expect(wrapper.findAll('[data-stops-signing]')).toHaveLength(2)
    expect(wrapper.get('[data-delete-skipped]').text()).toContain('example.net')
  })
})
