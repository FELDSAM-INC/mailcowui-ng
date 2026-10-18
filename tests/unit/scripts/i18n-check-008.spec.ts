// UI 008 (research R19, T002): the translation check requires a text for every value of the
// sync-job enumerations the screens show (encryption, last result, bulk action) and for the
// `hostName` format of `invalidFormat`.
import { describe, expect, it } from 'vitest'

import { checkCoverage, REQUIRED_FORMATS, requiredKeys } from '../../../scripts/i18n/lib.mjs'

const enums = {
  syncJobEncryptionValues: ['ssl', 'starttls', 'plain'],
  syncJobLastResultValues: ['succeeded', 'failed', 'unknown'],
  syncJobBulkActionValues: ['activate', 'deactivate', 'reschedule', 'delete'],
}

const SYNC_JOB_KEYS = [
  'enums.syncJobEncryption.ssl',
  'enums.syncJobEncryption.starttls',
  'enums.syncJobEncryption.plain',
  'enums.syncJobLastResult.succeeded',
  'enums.syncJobLastResult.failed',
  'enums.syncJobLastResult.unknown',
  'enums.syncJobBulkAction.activate',
  'enums.syncJobBulkAction.deactivate',
  'enums.syncJobBulkAction.reschedule',
  'enums.syncJobBulkAction.delete',
]

describe('sync-job enumerations in the translation check', () => {
  it('requires every value of the three closed enumerations', () => {
    expect(requiredKeys({ enums, problemNames: [] })).toEqual(
      expect.arrayContaining(SYNC_JOB_KEYS),
    )
  })

  it('keeps them fully required with the coverage manifest', () => {
    const { required, errors } = checkCoverage({
      coverage: { partial: {}, complete: {} },
      enums,
      problemNames: [],
      contract: {},
    })
    expect(errors).toEqual([])
    expect(required).toEqual(expect.arrayContaining(SYNC_JOB_KEYS))
  })

  it('requires the hostName format message of invalidFormat', () => {
    expect(REQUIRED_FORMATS).toContain('hostName')
    expect(requiredKeys({ enums: {}, problemNames: [] })).toContain('validation.format.hostName')
    const { required } = checkCoverage({
      coverage: { partial: {}, complete: {} },
      enums: {},
      problemNames: [],
      contract: {},
    })
    expect(required).toContain('validation.format.hostName')
  })
})
