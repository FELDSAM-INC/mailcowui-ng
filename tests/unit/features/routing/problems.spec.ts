// UI 009 T011: the routing problems with legacy's messages (research R19, legacy form map part 2):
// an existing entry at its field with the entry type's `danger.*_exists`, the shared next hop
// conflicts, the routing rule codes through the form-context lookup, the shared problem messages,
// and the `because` variant of `required`.
import { beforeAll, describe, expect, it } from 'vitest'

import { ApiProblem, type FieldViolation } from '@/api'
import { conflictOnField, conflictText, legacyBccType } from '@/features/routing/problems'
import { hasMessage, text } from '@/i18n'
import { loadLegacy } from '@/i18n/legacy'
import { problemMessage, violationMessage, type MessageTranslator } from '@/i18n/problems'

const tr: MessageTranslator = { t: text, te: hasMessage, locale: 'en-gb' }

const problem = (name: string, status: number, extensions: Record<string, unknown> = {}) =>
  ApiProblem.fromParts({ kind: 'problem', type: `/api/v2/problems/${name}`, status, extensions })

const violation = (code: string, params: Record<string, unknown> = {}): FieldViolation =>
  ({ code, params, message: 'never shown' }) as FieldViolation

beforeAll(async () => {
  await loadLegacy('en-gb')
})

describe('conflictOnField', () => {
  const exists = (field: string) =>
    problem('routing-entry-exists', 409, { field, conflictingId: 4 })

  it('puts each entry type’s legacy message at its field', () => {
    expect(
      conflictOnField('transport', exists('destination'), { destination: 'a.example' }),
    ).toEqual({ destination: ['Transport destination "a.example" exists'] })
    expect(
      conflictOnField('bccMap', exists('localDestination'), {
        localDestination: '@example.org',
        type: 'recipient',
      }),
    ).toEqual({ localDestination: ['A BCC map @example.org exists for type rcpt'] })
    expect(
      conflictOnField('bccMap', exists('type'), {
        localDestination: 'a@example.org',
        type: 'sender',
      }),
    ).toEqual({ type: ['A BCC map a@example.org exists for type sender'] })
    expect(
      conflictOnField('recipientMap', exists('originalDestination'), {
        originalDestination: 'old@example.org',
      }),
    ).toEqual({ originalDestination: ['A Recipient map entry "old@example.org" exists'] })
    expect(
      conflictOnField('tlsPolicyMap', exists('destination'), { destination: 'x.example' }),
    ).toEqual({ destination: ['A TLS policy map entry "x.example" exists'] })
  })

  it('reports the shared next hop conflicts at the username and the next hop', () => {
    const differ = conflictOnField('transport', problem('next-hop-credentials-differ', 409), {})
    expect(Object.keys(differ!)).toEqual(['username'])
    expect(differ!.username![0]).toBe(
      problemMessage(problem('next-hop-credentials-differ', 409), tr),
    )
    const interferes = conflictOnField(
      'transport',
      problem('next-hop-interferes', 409, { nextHop: '[mx.partner.net]:25', transportIds: [1] }),
      { nextHop: 'mx.partner.net:25' },
    )
    expect(interferes!.nextHop![0]).toContain('[mx.partner.net]:25')
    expect(interferes!.nextHop![0]).toContain('mx.partner.net:25')
  })

  it('leaves other problems to the generic message', () => {
    expect(conflictOnField('transport', problem('version-mismatch', 412), {})).toBeNull()
    expect(conflictText('transport', problem('version-mismatch', 412), {})).toBeNull()
    expect(
      conflictText('recipientMap', exists('originalDestination'), { originalDestination: 'x' }),
    ).toBe('A Recipient map entry "x" exists')
    expect([legacyBccType('recipient'), legacyBccType('sender'), legacyBccType(undefined)]).toEqual(
      ['rcpt', 'sender', 'sender'],
    )
  })
})

describe('routing rule codes through the form-context lookup', () => {
  const message = (formKey: string, path: string, code: string, entry?: string, params = {}) =>
    violationMessage(violation(code, params), tr, {
      formKey,
      path,
      valueAt: (at) => (at === path ? entry : undefined),
    })

  it.each([
    [
      'routing.relayhosts.form',
      'host',
      'invalidFormat',
      'bad host',
      'Invalid host specified: bad host',
    ],
    [
      'routing.transports.form',
      'nextHop',
      'invalidFormat',
      undefined,
      'Next hop format is invalid',
    ],
    [
      'routing.forwardingHosts.form',
      'host',
      'notResolvable',
      'x.example',
      'Invalid host specified: x.example',
    ],
    [
      'routing.bccMaps.form',
      'bccDestination',
      'required',
      undefined,
      'BCC destination cannot be empty',
    ],
  ])('%s %s %s shows legacy’s message', (formKey, path, code, entry, expected) => {
    expect(message(formKey, path, code, entry)).toContain(expected)
  })

  it('shows the transport destination, BCC, recipient and TLS messages verbatim', () => {
    expect(message('routing.transports.form', 'destination', 'invalidRegex', '(')).toContain('(')
    expect(message('routing.bccMaps.form', 'bccDestination', 'tooMany', 'a@x, b@x')).toContain(
      'a@x, b@x',
    )
    expect(
      message('routing.recipientMaps.form', 'originalDestination', 'invalidFormat', 'o'),
    ).toContain('original recipient')
    expect(message('routing.recipientMaps.form', 'newDestination', 'invalidFormat', 'n')).toContain(
      'new recipient',
    )
    expect(message('routing.tlsPolicyMaps.form', 'destination', 'invalidFormat')).toBeTruthy()
    expect(message('routing.tlsPolicyMaps.form', 'parameters', 'invalidFormat')).toBeTruthy()
  })

  it('names the password as the reason of a required username, and the forbidden characters', () => {
    expect(violationMessage(violation('required', { because: 'password' }), tr)).toBe(
      'A username is needed for a password.',
    )
    expect(violationMessage(violation('invalidCharacter', { characters: '*' }), tr)).toBeTruthy()
    expect(violationMessage(violation('invalidRegex'), tr)).toBe(
      'This is not a valid regular expression.',
    )
    expect(violationMessage(violation('notResolvable'), tr)).toBe(
      'This name resolves to no address.',
    )
  })

  it('translates the routing problem types', () => {
    for (const name of [
      'routing-entry-exists',
      'next-hop-credentials-differ',
      'next-hop-interferes',
    ]) {
      const text = problemMessage(problem(name, 409, { nextHop: 'x', conflictingId: 1 }), tr)
      expect(text).toBeTruthy()
      expect(text).not.toContain('problem.')
    }
  })
})
