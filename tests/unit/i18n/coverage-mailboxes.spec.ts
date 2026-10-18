// UI 003's translation scope (research R2, data-model §9): the growing shared enumerations list the
// values the mailbox screens translate in UI 002's registry (`src/i18n/coverage.json`, `partial`),
// and the closed enumerations whose labels are built at runtime are fully required through its
// `complete` section. UI 002's mechanism is reused unchanged: no second registry, and no addition to
// `ENUM_NAMESPACES` (closed enumerations shown through typed tables of legacy keys need no entry).
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { ENUM_NAMESPACES, resolvePointer } from '../../../scripts/i18n/lib.mjs'

const coverage = JSON.parse(readFileSync('src/i18n/coverage.json', 'utf8')) as {
  partial: Record<string, string[]>
  complete: Record<string, string>
}
const contract = JSON.parse(readFileSync('contract/openapi.json', 'utf8')) as unknown

const UI003_PARTIAL: Record<string, string[]> = {
  AuditEventType: [
    'mailboxCreation',
    'mailboxUpdate',
    'mailboxDeletion',
    'mailboxRename',
    'mailboxTemplateCreation',
    'mailboxTemplateUpdate',
    'mailboxTemplateDeletion',
  ],
  'AuditTarget.type': ['mailbox', 'mailboxTemplate'],
  AuditFailureReason: [
    'outcomeUnknown',
    'partiallyCompleted',
    'attributeNotPermitted',
    'versionOutdated',
    'validationFailed',
    'conflict',
    'temporaryFailure',
    'permissionDenied',
    'notFound',
  ],
  ValidationRuleCode: [
    'notMultipleOf',
    'missingCharacterClass',
    'conflictsWith',
    'unchanged',
    'immutable',
    'outOfRange',
    'notEligible',
    'tooMany',
    'notInList',
  ],
  problemTypes: [
    'address-in-use',
    'mailbox-limit-reached',
    'mailbox-not-renamable',
    'mailbox-rename-incomplete',
    'outcome-unknown',
    'mailbox-template-name-exists',
    'mailbox-template-protected',
    'domain-alias-limit-reached',
    'permission-flag-required',
    'attribute-not-permitted',
    'temporary-failure',
  ],
}

const UI003_COMPLETE: Record<string, string> = {
  'mailboxes.status': '#/components/schemas/MailboxStatus',
  'mailboxes.sort': '#/components/parameters/MailboxSort/schema',
  'mailboxes.rename.step': '#/components/schemas/MailboxRenameStep/properties/step',
  'mailboxes.rename.outcome': '#/components/schemas/MailboxRenameStep/properties/outcome',
  'mailboxes.delete.blocker':
    '#/components/schemas/MailboxDeletionPreview/properties/blockers/items/properties/dependency',
}

describe('UI 003 translation scope (research R2, data-model §9)', () => {
  it.each(Object.entries(UI003_PARTIAL))(
    'lists the %s values UI 003 translates',
    (name, values) => {
      expect(coverage.partial[name]).toEqual(expect.arrayContaining(values))
    },
  )

  it.each(Object.entries(UI003_COMPLETE))(
    'requires every value of the closed enumeration %s',
    (prefix, pointer) => {
      expect(coverage.complete[prefix]).toBe(pointer)
      const target = resolvePointer(contract, pointer) as { enum?: unknown[] } | undefined
      expect(Array.isArray(target?.enum)).toBe(true)
    },
  )

  it('reuses the template sort labels of UI 002, whose values are the same', () => {
    const domain = resolvePointer(contract, '#/components/parameters/DomainTemplateSort/schema')
    const mailbox = resolvePointer(contract, '#/components/parameters/MailboxTemplateSort/schema')
    expect((mailbox as { enum: string[] }).enum).toEqual(
      expect.arrayContaining((domain as { enum: string[] }).enum),
    )
    expect((domain as { enum: string[] }).enum).toEqual(
      expect.arrayContaining((mailbox as { enum: string[] }).enum),
    )
  })

  it('adds no closed enumeration to ENUM_NAMESPACES (the coverage manifest scopes them)', () => {
    expect(Object.keys(ENUM_NAMESPACES).filter((name) => name.startsWith('mailbox'))).toEqual([])
  })
})
