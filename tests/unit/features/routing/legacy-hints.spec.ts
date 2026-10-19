// UI 009 T003: the legacy hints of the routing screens through UI 001's legacy translation layer
// (research R20, R21; constitution IV 1.3.0): rendered from the loaded value through the
// sanitiser, unaltered (their `<br>`, `<b>`, `<code>` and `<a>` survive, `&#8226;` stays a bullet),
// a key the selected language lacks falling back to en-gb, and `%s` filled in order.
import { afterEach, describe, expect, it } from 'vitest'

import { legacyRaw, loadLegacy, lt, resetLegacy, type LegacyKey } from '@/i18n/legacy'
import LegacyText from '@/shared/components/LegacyText.vue'

import { mountWithApp } from '../../support/mount'

afterEach(() => {
  resetLegacy()
})

const HINTS: [LegacyKey, string[]][] = [
  ['admin.relayhosts_hint', ['br']],
  ['add.relayhost_wrapped_tls_info', ['b', 'br']],
  ['admin.transports_hint', ['b', 'br']],
  ['admin.lookup_mx', ['code']],
  ['edit.lookup_mx', ['code']],
  ['admin.credentials_transport_warning', ['b']],
  ['mailbox.bcc_info', ['br']],
  ['add.bcc_dest_format', ['br']],
  ['edit.bcc_dest_format', ['br']],
  ['mailbox.tls_policy_maps_info', ['br', 'a']],
  ['mailbox.tls_policy_maps_enforced_tls', ['code']],
  ['admin.transport_test_rcpt_info', []],
]

const textOf = (html: string) => {
  const element = document.createElement('div')
  element.innerHTML = html
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim()
}

describe('routing legacy hints', () => {
  it.each(HINTS)('renders %s verbatim through the sanitiser', async (key, tags) => {
    await loadLegacy('en-gb')
    const wrapper = mountWithApp(LegacyText, { props: { k: key, as: 'p' } })
    for (const tag of tags) expect(wrapper.find(tag).exists(), tag).toBe(true)
    // Nothing is stripped or rewritten: the visible text is the loaded value's text.
    expect(wrapper.text().replace(/\s+/g, ' ').trim()).toBe(textOf(legacyRaw(key)))
  })

  it('keeps the bullets and the documentation link of the hints', async () => {
    await loadLegacy('en-gb')
    const bullets = mountWithApp(LegacyText, { props: { k: 'admin.transport_test_rcpt_info' } })
    expect(bullets.text()).toContain('• Use null@hosted.mailcow.de')
    const link = mountWithApp(LegacyText, { props: { k: 'mailbox.tls_policy_maps_info' } })
    expect(link.get('a').attributes('href')).toContain('smtp_tls_policy_maps')
  })

  it('fills %s in order (danger.bcc_exists has two)', async () => {
    await loadLegacy('en-gb')
    expect(lt('danger.bcc_exists', '@example.org', 'rcpt')).toBe(
      'A BCC map @example.org exists for type rcpt',
    )
  })

  it('falls back to en-gb for a routing key the selected language lacks', async () => {
    await loadLegacy('sk-sk')
    // Every routing key resolves to a value, never to the key or a hand-written text.
    for (const [key] of HINTS) expect(legacyRaw(key)).not.toBe(key)
    expect(lt('mailbox.tls_policy_maps_long')).not.toBe('mailbox.tls_policy_maps_long')
  })
})
