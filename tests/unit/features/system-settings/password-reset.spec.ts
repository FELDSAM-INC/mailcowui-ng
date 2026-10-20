import { describe, expect, it } from 'vitest'
import type { PasswordResetNotification } from '@/api'
import {
  notificationDraft,
  notificationPatch,
  resetWarnings,
  validateNotification,
} from '@/features/system-settings/lib/password-reset'

const saved: PasswordResetNotification = {
  sender: 'no-reply@example.org',
  subject: 'Reset password',
  textTemplate: 'Open {{link}}',
  htmlTemplate: '<p>Open {{link}}</p>',
  templatesAreDefault: true,
  passwordResetAvailable: true,
  etag: '"reset-1"',
}

describe('password reset notification draft', () => {
  it('permits documented local-domain senders and rejects every control character in the subject', () => {
    expect(
      validateNotification(
        { ...notificationDraft(saved), sender: 'quota-warning@localhost' },
        1048576,
      ),
    ).toEqual({})
    expect(
      validateNotification({ ...notificationDraft(saved), subject: 'subject\twith tab' }, 1048576),
    ).toHaveProperty('subject')
  })
  it('does not persist returned default templates when only the sender changes', () => {
    const draft = notificationDraft(saved)
    draft.sender = 'help@example.org'
    expect(notificationPatch(draft, saved)).toEqual({ sender: 'help@example.org' })
    expect(notificationPatch(notificationDraft(saved), saved)).toBeNull()
  })
  it('restores both stored templates with empty strings', () => {
    const custom = { ...saved, templatesAreDefault: false }
    const draft = { ...notificationDraft(custom), textTemplate: '', htmlTemplate: '' }
    expect(notificationPatch(draft, custom)).toEqual({ textTemplate: '', htmlTemplate: '' })
    expect(resetWarnings(draft)).toEqual({
      missingLink: false,
      oneEmpty: false,
      restoresDefaults: true,
    })
  })
  it('keeps the displayed default counterpart when editing one default template', () => {
    const draft = { ...notificationDraft(saved), textTemplate: 'New message {{link}}' }
    expect(notificationPatch(draft, saved)).toEqual({
      textTemplate: 'New message {{link}}',
      htmlTemplate: saved.htmlTemplate,
    })
  })
  it('warns for missing links and one empty template without treating them as invalid', () => {
    const draft = { ...notificationDraft(saved), textTemplate: 'Contact support', htmlTemplate: '' }
    expect(resetWarnings(draft)).toEqual({
      missingLink: true,
      oneEmpty: true,
      restoresDefaults: false,
    })
    expect(validateNotification(draft, 1048576)).toEqual({})
  })
  it('validates sender, line breaks, Unicode subject length and UTF-8 template bytes', () => {
    const draft = {
      ...notificationDraft(saved),
      sender: 'no-reply@',
      subject: 'a\nb',
      textTemplate: 'ééé',
    }
    expect(Object.keys(validateNotification(draft, 5))).toEqual([
      'sender',
      'subject',
      'textTemplate',
      'htmlTemplate',
    ])
    expect(
      validateNotification({ ...notificationDraft(saved), subject: '😀'.repeat(255) }, 1048576),
    ).toEqual({})
    expect(
      validateNotification({ ...notificationDraft(saved), subject: 'a'.repeat(256) }, 1048576),
    ).toHaveProperty('subject')
  })
})
