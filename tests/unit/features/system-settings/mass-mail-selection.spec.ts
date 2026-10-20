import { describe, expect, it } from 'vitest'
import {
  normaliseSelection,
  selectionKey,
  selectionFromDraft,
  validateMassMail,
  failureLabel,
} from '@/features/system-settings/lib/selection'

describe('mass mail selection and message validation', () => {
  it('deduplicates case-insensitively without reordering error indexes', () => {
    expect(
      normaliseSelection({
        domains: [' EXAMPLE.NET ', 'example.org', 'example.net'],
        include: [' B@example.net ', 'a@example.org', 'b@example.net'],
      }),
    ).toEqual({
      domains: ['example.net', 'example.org'],
      include: ['b@example.net', 'a@example.org'],
    })
    expect(selectionKey({ domains: ['example.org', 'EXAMPLE.NET'] })).toBe(
      selectionKey({ domains: ['example.net', 'example.org'] }),
    )
  })
  it('preserves an explicitly empty inclusion and maps only the selected list', () => {
    expect(normaliseSelection({ include: [] })).toEqual({ include: [] })
    expect(
      selectionFromDraft({
        scope: 'all',
        domains: ['example.org'],
        listMode: 'include',
        mailboxes: [],
      }),
    ).toEqual({ include: [] })
    expect(
      selectionFromDraft({
        scope: 'domains',
        domains: ['example.org'],
        listMode: 'exclude',
        mailboxes: ['a@example.org'],
      }),
    ).toEqual({ domains: ['example.org'], exclude: ['a@example.org'] })
  })
  it('requires sender, a single-line subject and plain body; counts UTF-8 bytes', () => {
    const draft = {
      sender: 'noreply@mail.example.org',
      subject: 'Maintenance',
      textBody: 'Message',
      htmlBody: '',
    }
    expect(validateMassMail(draft, 10)).toEqual({})
    expect(
      validateMassMail({ ...draft, sender: 'bad', subject: 'a\nb', textBody: 'á'.repeat(6) }, 10),
    ).toMatchObject({ sender: 'sender', subject: 'subjectSingleLine', textBody: 'bodyTooLong' })
    expect(validateMassMail({ ...draft, subject: 'x'.repeat(256) }, 10)).toMatchObject({
      subject: 'subjectTooLong',
    })
    expect(
      validateMassMail({ ...draft, subject: '', textBody: '', htmlBody: 'á'.repeat(6) }, 10),
    ).toMatchObject({ subject: 'subject', textBody: 'textBody', htmlBody: 'bodyTooLong' })
  })
  it('maps stable failure codes and unknown codes without displaying SMTP replies', () => {
    expect(failureLabel('overQuota')).toBe('overQuota')
    expect(failureLabel('connectionFailed')).toBe('connectionFailed')
    expect(failureLabel('interrupted')).toBe('interrupted')
    expect(failureLabel('550 raw diagnostic')).toBe('rejected')
    expect(failureLabel(null)).toBe('rejected')
  })
})
