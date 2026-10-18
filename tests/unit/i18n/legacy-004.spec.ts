// UI 004's cases of UI 001's legacy translation layer (T003, research R20, constitution IV 1.3.0):
// placeholders filled in order, values with markup rendered unchanged through the sanitiser, and a
// key the upstream sk-sk file lacks falling back to en-gb.
import { afterEach, describe, expect, it } from 'vitest'

import { loadLegacy, lt, resetLegacy } from '@/i18n/legacy'
import LegacyText from '@/shared/components/LegacyText.vue'

import { mountWithApp } from '../support/mount'

afterEach(() => {
  resetLegacy()
})

describe('legacy texts of UI 004', () => {
  it('fills %s and %d in order (success.alias_added with the address and the ID)', async () => {
    await loadLegacy('en-gb')
    expect(lt('success.alias_added', 'sales@example.org', 42)).toBe(
      'Alias address sales@example.org (42) has been added',
    )
    expect(lt('edit.dont_check_sender_acl', 'example.com')).toBe(
      'Disable sender check for domain example.com (+ alias domains)',
    )
  })

  it.each([
    ['add.goto_spam', 'b', 'spam'],
    ['add.goto_ham', 'b', 'ham'],
    ['add.alias_address_info', 'b', 'mailcow domains only'],
    ['mailbox.alias_domain_alias_hint', 'code', 'my-alias@domain'],
  ] as const)('renders %s with its markup through the sanitiser', async (key, tag, text) => {
    await loadLegacy('en-gb')
    const wrapper = mountWithApp(LegacyText, { props: { k: key } })
    expect(wrapper.find(tag).text()).toBe(text)
    // The value's own attributes (legacy's Bootstrap classes) are dropped, its text is not.
    expect(wrapper.find('.legacy-html').element.innerHTML).not.toContain('class=')
  })

  it('keeps the line breaks of edit.sender_acl_info and edit.extended_sender_acl_info', async () => {
    await loadLegacy('en-gb')
    for (const key of ['edit.sender_acl_info', 'edit.extended_sender_acl_info'] as const) {
      const wrapper = mountWithApp(LegacyText, { props: { k: key } })
      expect(wrapper.findAll('br').length).toBeGreaterThan(0)
    }
  })

  it('falls back to en-gb for add.internal, which the upstream sk-sk file lacks', async () => {
    await loadLegacy('sk-sk')
    expect(lt('add.internal')).toBe('Internal')
    expect(lt('edit.sender_allowed')).toBe('Allow to send as this alias')
    expect(lt('add.active')).not.toBe('Active')
  })
})
