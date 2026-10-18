// The domain-wide footer (UI 002 T090): the UTF-8 size, the payload, the merge of a "Save again",
// and the exclusion multi-select of the domain's mailboxes, aliases and alias domains.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { DomainFooter } from '@/api'
import ExclusionSelect from '@/features/domains/components/footer/ExclusionSelect.vue'
import {
  footerForm,
  mergeFooterChanges,
  toFooterReplace,
  utf8Bytes,
  validateFooter,
} from '@/features/domains/footer'

import { mockDomain } from '../../../mocks/factories/domain'
import { useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

const footer = (overrides: Partial<DomainFooter> = {}): DomainFooter => ({
  domain: 'x.example',
  html: '',
  plain: '',
  skipReplies: false,
  excludedAddresses: [],
  excludedAliasDomains: [],
  etag: '"f1"',
  ...overrides,
})

describe('footer model', () => {
  it('measures texts in UTF-8 bytes and refuses one above the limit', () => {
    expect(utf8Bytes('ž')).toBe(2)
    expect(utf8Bytes('€')).toBe(3)
    const errors = validateFooter({ ...footerForm(footer()), plain: 'žžž' }, 5, {
      size: (bytes) => `${bytes} B`,
    })
    expect(errors).toEqual({ plain: [{ key: 'validation.tooLongBytes', params: { max: '5 B' } }] })
  })

  it('maps the form to the replacement one to one', () => {
    const form = footerForm(footer({ html: '<b>x</b>', excludedAddresses: ['a@x.example'] }))
    expect(toFooterReplace(form)).toEqual({
      html: '<b>x</b>',
      plain: '',
      skipReplies: false,
      excludedAddresses: ['a@x.example'],
      excludedAliasDomains: [],
    })
  })

  it('a "Save again" keeps the values changed elsewhere and applies only the user\'s changes', () => {
    const opened = footer({ plain: 'old' })
    const latest = footer({ plain: 'old', skipReplies: true, etag: '"f2"' })
    const form = { ...footerForm(opened), plain: 'mine' }
    expect(mergeFooterChanges(opened, latest, form)).toMatchObject({
      plain: 'mine',
      skipReplies: true,
    })
  })
})

describe('ExclusionSelect', () => {
  function seed() {
    const state = useScenario('admin-active')
    state.domains = [
      mockDomain({
        name: 'x.example',
        mailboxAddresses: ['ann@x.example'],
        aliasAddresses: ['sales@x.example'],
      }),
    ]
    state.aliasDomains = [{ name: 'alias.x.example', target: 'x.example' }]
  }

  it('lists mailboxes, aliases and alias domains in legacy order, keeps stale entries, and splits the selection', async () => {
    seed()
    const wrapper = mountWithApp(ExclusionSelect, {
      props: {
        id: 'exclude',
        domain: 'x.example',
        addresses: ['gone@x.example'],
        aliasDomains: [],
      },
    })
    await vi.waitFor(() => expect(wrapper.findAll('option')).toHaveLength(4))
    expect(wrapper.findAll('option').map((option) => option.text())).toEqual([
      'ann@x.example',
      'gone@x.example',
      'sales@x.example (Alias)',
      'alias.x.example (Alias-Domain)',
    ])
    expect(wrapper.get('label').text()).toBe('Exclude from footer')
    const select = wrapper.get('select').element as HTMLSelectElement
    for (const option of select.options) option.selected = option.value !== 'a:gone@x.example'
    await wrapper.get('select').trigger('change')
    expect(wrapper.emitted('update:addresses')!.at(-1)).toEqual([
      ['ann@x.example', 'sales@x.example'],
    ])
    expect(wrapper.emitted('update:aliasDomains')!.at(-1)).toEqual([['alias.x.example']])
    expect(wrapper.find('input[type="search"]').exists()).toBe(false)
    await flushPromises()
  })
})
