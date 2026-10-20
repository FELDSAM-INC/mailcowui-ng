import { beforeAll, expect, it, vi } from 'vitest'
import OneTimeSecretDialog from '@/shared/components/OneTimeSecretDialog.vue'
import GroupedSecret from '@/shared/components/GroupedSecret.vue'
import { loadLegacy } from '@/i18n/legacy'
import { mountWithApp } from '../../support/mount'

beforeAll(() => loadLegacy('en-gb'))
it('groups a secret visually while preserving its raw accessible text', () => {
  const wrapper = mountWithApp(GroupedSecret, {
    props: { value: 'abcdefgh12345678', copyLabel: 'Copy' },
  })
  expect(
    wrapper.findAll('[data-grouped-secret] > span:not(.sr-only)').map((e) => e.text()),
  ).toEqual(['abcd', 'efgh', '1234', '5678'])
  expect(wrapper.get('[data-grouped-secret]').text()).toBe('abcd, efgh, 1234, 5678')
})
it('shows the username separately and copies the ungrouped app password', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  mountWithApp(OneTimeSecretDialog, {
    props: {
      secret: 'abcdefgh12345678',
      username: 'anna@example.org',
      grouped: true,
      title: 'App password',
    },
    attachTo: document.body,
  })
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull())
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('anna@example.org')
  const button = [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === 'Copy',
  )!
  await vi.waitFor(() => expect(document.activeElement).toBe(button))
  button.click()
  await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('abcdefgh12345678'))
})
