import { beforeEach, describe, expect, it } from 'vitest'
import { i18n, loadFeatureMessages } from '@/i18n'
import JobProgress from '@/features/system-settings/components/mass-mail/JobProgress.vue'
import RecipientSelection from '@/features/system-settings/components/mass-mail/RecipientSelection.vue'
import SendConfirmDialog from '@/features/system-settings/components/mass-mail/SendConfirmDialog.vue'
import { mountWithApp } from '../../support/mount'
beforeEach(async () => {
  await loadFeatureMessages('system-settings', i18n, 'en-gb')
})
describe('mass mail confirmation and progress', () => {
  it('gives every graph segment a text equivalent', () => {
    const wrapper = mountWithApp(JobProgress, {
      props: { counts: { delivered: 7, failed: 2, skipped: 1, pending: 10 } },
    })
    expect(wrapper.text()).toContain('Delivered')
    expect(wrapper.text()).toContain('Pending')
    expect(wrapper.findAll('dd').map((item) => item.text())).toEqual(['7', '2', '1', '10'])
    expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true')
  })
  it('shows confirmation facts without treating message text as markup', () => {
    const wrapper = mountWithApp(SendConfirmDialog, {
      props: {
        message: {
          sender: 'noreply@example.org',
          subject: '<script>bad()</script>',
          textBody: 'test',
          selection: {},
          expectedRecipients: 120,
        },
        summary: 'All receiving mailboxes',
      },
    })
    expect(wrapper.text()).toContain('120')
    expect(wrapper.text()).toContain('cannot be recalled')
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.emitted()).toEqual({})
  })
  it('uses the singular recipient count and plural send labels in every supported locale', async () => {
    const wrapper = mountWithApp(SendConfirmDialog, {
      props: {
        message: {
          sender: 'a@example.org',
          subject: 'Notice',
          textBody: 'Message',
          selection: {},
          expectedRecipients: 1,
        },
        summary: 'All',
      },
    })
    expect(wrapper.text()).toContain('1 recipient')
    expect(wrapper.text()).not.toContain('1 recipients')
    for (const [locale, expected] of [
      ['en-gb', 'Send to 1 mailbox'],
      ['cs-cz', 'Odeslat do 1 schránky'],
      ['sk-sk', 'Odoslať do 1 schránky'],
    ] as const) {
      await loadFeatureMessages('system-settings', i18n, locale)
      i18n.global.locale.value = locale
      expect(i18n.global.t('systemSettings.massMail.sendCount', { count: '1' }, 1)).toBe(expected)
    }
    wrapper.unmount()
  })
  it('reuses the legacy include/exclude label and the default-selection explanation', () => {
    const wrapper = mountWithApp(RecipientSelection, {
      props: {
        draft: { scope: 'all', domains: [], listMode: 'none', mailboxes: [] },
        max: 10000,
        errors: () => [],
      },
    })
    expect(wrapper.get('label[for="mass-list-mode"]').text()).toBe('Include/Exclude')
    expect(wrapper.text()).toContain('By default - with no selection - all mailboxes are addressed')
    wrapper.unmount()
  })
})
