import { describe, expect, it } from 'vitest'
import type { QuotaNotificationSettings } from '@/api'
import {
  quotaDraft,
  quotaPatch,
  copiesDraft,
  copiesPatch,
  validateCopies,
} from '@/features/system-settings/lib/quota'

const saved: QuotaNotificationSettings = {
  sender: 'quota-warning@localhost',
  senderIsDefault: true,
  subject: 'Quota warning',
  subjectIsDefault: true,
  htmlTemplate: '<p>{{username}} {{percent}}</p>',
  htmlTemplateIsDefault: true,
  etag: '"quota-1"',
}
describe('quota settings drafts', () => {
  it('accepts the contract recipient length and rejects the next character', () => {
    const suffix = '@example.org'
    const maximum = `${'a'.repeat(255 - suffix.length)}${suffix}`
    expect(validateCopies({ recipients: maximum, active: true }, 100)).toEqual({})
    expect(validateCopies({ recipients: `a${maximum}`, active: true }, 100)).toEqual({
      'recipients.0': 'validation.tooLong',
    })
  })
  it('does not resend projected defaults while editing another field', () => {
    expect(quotaPatch({ ...quotaDraft(saved), subject: 'Warning' }, saved)).toEqual({
      subject: 'Warning',
    })
    expect(quotaPatch(quotaDraft(saved), saved)).toBeNull()
    expect(quotaPatch({ ...quotaDraft(saved), htmlTemplate: '' }, saved)).toEqual({
      htmlTemplate: '',
    })
  })
  it('splits pasted addresses, deduplicates case-insensitively, and replaces the entire list', () => {
    const current = {
      domain: 'example.org',
      active: false,
      recipients: ['old@example.org'],
      etag: '"copies-1"',
    }
    const draft = {
      ...copiesDraft(current),
      recipients: 'IT@example.org; boss@example.net\nit@example.org, new@example.org',
      active: true,
    }
    expect(copiesPatch(draft, current)).toEqual({
      recipients: ['IT@example.org', 'boss@example.net', 'new@example.org'],
      active: true,
    })
    expect(validateCopies(draft, 100)).toEqual({})
  })
  it('validates every entry and the advertised limit before sending, preserves empty-active intent for the API', () => {
    expect(
      validateCopies({ recipients: 'one@example.org not-an-address', active: true }, 1),
    ).toEqual({ recipients: 'validation.tooMany', 'recipients.1': 'validation.format.email' })
    const current = {
      domain: 'example.org',
      active: true,
      recipients: ['one@example.org'],
      etag: '"copies-1"',
    }
    expect(copiesPatch({ recipients: '', active: true }, current)).toEqual({
      recipients: [],
      active: true,
    })
  })
})
