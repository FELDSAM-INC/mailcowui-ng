// UI 006 (T002, research R2, constitution IV 1.3.0): the translation check covers this feature:
// every legacy key of its legacy form map is a text of the bundled en-gb snapshot; every value of
// the closed 006 enumerations needs a label (a new string or a LEGACY_TEXTS entry), read from the
// contract through the coverage manifest; the `invalidTemplate` reasons are required as a fixed
// list; and a 006 value listed without a text fails the check.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  checkCoverage,
  checkMessages,
  getPath,
  REQUIRED_TEMPLATE_REASONS,
  resolvePointer,
  type Coverage,
} from '../../../scripts/i18n/lib.mjs'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const snapshot = JSON.parse(read('src/i18n/snapshot/lang.en-gb.json')) as Record<string, unknown>
const contract = JSON.parse(read('contract/openapi.json')) as unknown
const coverage = JSON.parse(read('src/i18n/coverage.json')) as Coverage

const CLOSED_006 = {
  'enums.quarantineItemAction': '#/components/schemas/QuarantineItemAction',
  'enums.quarantineNotificationFrequency': '#/components/schemas/QuarantineNotificationFrequency',
  'enums.quarantineNotificationCategory': '#/components/schemas/QuarantineNotificationCategory',
  'enums.quarantineReleaseFormat': '#/components/schemas/QuarantineReleaseFormat',
  'enums.quarantineReportAction': '#/components/schemas/QuarantineActionReport/properties/action',
  'enums.quarantineReportDelivery':
    '#/components/schemas/QuarantineActionReport/properties/delivery',
  'enums.quarantineReportLearning':
    '#/components/schemas/QuarantineActionReport/properties/learning',
  'enums.quarantineReportFuzzy': '#/components/schemas/QuarantineActionReport/properties/fuzzy',
  'enums.quarantineContentStatus':
    '#/components/schemas/QuarantineItemDetails/allOf/1/properties/contentStatus',
  'enums.quarantineRecipientSource': '#/components/schemas/QuarantineRecipient/properties/source',
  'enums.spamFilterDependency':
    '#/components/schemas/SpamFilterTemporaryFailureProblem/allOf/1/properties/dependency',
  'enums.spamFilterStep':
    '#/components/schemas/SpamFilterTemporaryFailureProblem/allOf/1/properties/step',
  'enums.spamPolicyList': '#/components/schemas/SpamPolicyList',
  'enums.spamPolicyOwnerKind': '#/components/schemas/SpamPolicyOwner/properties/kind',
  'enums.rateLimitObjectKind': '#/components/schemas/RateLimitObjectKind',
  'enums.rateLimitFrame': '#/components/schemas/RateLimitValue/properties/frame',
  'enums.rateLimitEffectiveSource': '#/components/schemas/RateLimit/properties/effectiveSource',
}

/** The backticked legacy keys of the plan's legacy form map (parts 1 to 3). */
function formMapLegacyKeys(): string[] {
  const plan = read('specs/006-quarantine-spam-policy/plan.md')
  const start = plan.indexOf('### Legacy form map, part 1')
  const end = plan.indexOf('## API dependency and gaps')
  const sections = new Set(Object.keys(snapshot))
  const keys = new Set<string>()
  for (const match of plan.slice(start, end).matchAll(/`([a-z0-9_]+(?:\.[A-Za-z0-9_]+)+)`/g)) {
    const key = match[1]!
    if (sections.has(key.split('.')[0]!)) keys.add(key)
  }
  return [...keys].sort()
}

describe('UI 006 translation coverage', () => {
  it('finds every legacy key of the form map in the en-gb snapshot', () => {
    const keys = formMapLegacyKeys()
    expect(keys.length).toBeGreaterThan(150)
    expect(keys.filter((key) => typeof getPath(snapshot, key) !== 'string')).toEqual([])
  })

  it('lists every closed 006 enumeration in the manifest, pointing at an enum', () => {
    for (const [prefix, pointer] of Object.entries(CLOSED_006)) {
      expect(coverage.complete?.[prefix]).toBe(pointer)
      const target = resolvePointer(contract, pointer) as { enum?: unknown[] } | undefined
      expect(Array.isArray(target?.enum)).toBe(true)
    }
  })

  it('requires a text for every value of those enumerations and every template reason', () => {
    const { required, errors } = checkCoverage({ coverage, enums: {}, problemNames: [], contract })
    // Without the generated arrays only the partial lists can complain; the pointers resolve.
    expect(errors.filter((error) => error.startsWith('coverage.json: complete'))).toEqual([])
    expect(required).toEqual(
      expect.arrayContaining([
        'enums.quarantineReportLearning.alreadyLearned',
        'enums.spamFilterDependency.sharedStore',
        'enums.rateLimitEffectiveSource.none',
        'enums.quarantineItemAction.other',
        ...REQUIRED_TEMPLATE_REASONS.map(
          (reason) => `validation.byParam.invalidTemplate.reason.${reason}`,
        ),
      ]),
    )
    expect(REQUIRED_TEMPLATE_REASONS).toEqual(['syntax', 'security', 'render', 'timeout'])
  })

  it('fails when a 006 value is listed without a text', () => {
    const { required } = checkCoverage({
      coverage: {
        partial: { AuditEventType: ['quarantineItemRelease'] },
        complete: { 'enums.spamFilterStep': CLOSED_006['enums.spamFilterStep'] },
      },
      enums: { auditEventTypeValues: ['quarantineItemRelease', 'signIn'] },
      problemNames: [],
      contract,
    })
    const app = { 'en-gb': {}, 'cs-cz': {}, 'sk-sk': {} }
    const { errors } = checkMessages({ app, required, snapshot })
    expect(errors).toEqual(
      expect.arrayContaining([
        'en-gb: required key enums.auditEventType.quarantineItemRelease is missing',
        'cs-cz: required key enums.spamFilterStep.learning is missing',
      ]),
    )
    // A LEGACY_TEXTS entry satisfies a required key.
    const withLegacy = checkMessages({
      app,
      required: ['enums.spamFilterDependency.spamFilter'],
      snapshot,
      legacyTexts: { 'enums.spamFilterDependency.spamFilter': 'user.spamfilter' },
    })
    expect(withLegacy.errors).toEqual([])
  })
})
