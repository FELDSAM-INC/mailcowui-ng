// The sync-job form model (UI 008 T017, data-model §2, §6, plan legacy form map): the legacy field
// order, the imapsync option names, the initial values from the capabilities, the port rule, the
// create body, the patch of changed members and the client checks with limits taken from the
// capabilities (nothing hard-coded, FR-055).
import { describe, expect, it } from 'vitest'

import type { SyncJob, SyncJobCapabilities } from '@/api'
import {
  checkValues,
  createBody,
  FIELD_ORDER,
  initialCreateValues,
  nextPort,
  OPTION_NAMES,
  patchFor,
  standardPort,
  toFormValues,
} from '@/features/sync-jobs/form-model'

import { mockSyncJob, syncJobCapabilities, syncJobView } from '../../../mocks/factories/sync-job'

const caps = syncJobCapabilities()
const job: SyncJob = syncJobView(
  mockSyncJob({ id: 9, mailbox: 'dora@example.org', customParameters: '--maxsize=1' }),
)

describe('the legacy form', () => {
  it("keeps the add form's field order and the option names of the checkboxes", () => {
    expect(FIELD_ORDER).toEqual([
      'remoteHost',
      'remotePort',
      'remoteUser',
      'remotePassword',
      'encryption',
      'intervalMinutes',
      'destinationSubfolder',
      'maxAgeDays',
      'maxBytesPerSecond',
      'remoteTimeoutSeconds',
      'localTimeoutSeconds',
      'exclude',
      'customParameters',
      'deleteDuplicatesOnDestination',
      'deleteFromSource',
      'deleteFromDestination',
      'automap',
      'skipCrossDuplicates',
      'subscribeAll',
      'dryRun',
      'active',
    ])
    expect(OPTION_NAMES).toEqual({
      deleteDuplicatesOnDestination: '--delete2duplicates',
      deleteFromSource: '--delete1',
      deleteFromDestination: '--delete2',
      automap: '--automap',
      skipCrossDuplicates: '--skipcrossduplicates',
      subscribeAll: '--subscribeall',
      dryRun: '--dry',
    })
  })
})

describe('initial values and the port rule', () => {
  it("starts from the capabilities defaults with the encryption's standard port", () => {
    const values = initialCreateValues(caps, { mailbox: 'dora@example.org' })
    expect(values).toMatchObject({
      mailbox: 'dora@example.org',
      remoteHost: '',
      remoteUser: '',
      remotePassword: '',
      remotePort: '993',
      encryption: 'ssl',
      intervalMinutes: '20',
      exclude: '(?i)spam|(?i)junk',
      maxAgeDays: '0',
      remoteTimeoutSeconds: '600',
      deleteDuplicatesOnDestination: true,
      automap: true,
      subscribeAll: true,
      dryRun: false,
      active: true,
    })
    const other = syncJobCapabilities({
      defaults: { ...caps.defaults, encryption: 'starttls', intervalMinutes: 45, dryRun: true },
    })
    expect(initialCreateValues(other, {})).toMatchObject({
      remotePort: '143',
      intervalMinutes: '45',
      dryRun: true,
      mailbox: '',
    })
  })

  it('follows the encryption until the port is typed into', () => {
    expect(standardPort('ssl')).toBe(993)
    expect(standardPort('starttls')).toBe(143)
    expect(standardPort('plain')).toBe(143)
    expect(nextPort({ port: '993', from: 'ssl', to: 'starttls', touched: false })).toBe('143')
    expect(nextPort({ port: '143', from: 'starttls', to: 'ssl', touched: false })).toBe('993')
    expect(nextPort({ port: '', from: 'plain', to: 'ssl', touched: false })).toBe('993')
    expect(nextPort({ port: '993', from: 'ssl', to: 'plain', touched: true })).toBe('993')
    expect(nextPort({ port: '1143', from: 'ssl', to: 'plain', touched: false })).toBe('1143')
  })
})

describe('create body', () => {
  const values = {
    ...initialCreateValues(caps, { mailbox: 'dora@example.org' }),
    remoteHost: ' imap.example ',
    remoteUser: 'dora',
    remotePassword: 'secret',
    intervalMinutes: '30',
    customParameters: '--maxsize=10',
  }

  it('sends every member with numbers as integers', () => {
    expect(createBody(values, { sendMailbox: true, customParamsAllowed: true })).toEqual({
      mailbox: 'dora@example.org',
      remoteHost: 'imap.example',
      remotePort: 993,
      encryption: 'ssl',
      remoteUser: 'dora',
      remotePassword: 'secret',
      intervalMinutes: 30,
      destinationSubfolder: '',
      maxAgeDays: 0,
      maxBytesPerSecond: 0,
      remoteTimeoutSeconds: 600,
      localTimeoutSeconds: 600,
      exclude: '(?i)spam|(?i)junk',
      customParameters: '--maxsize=10',
      deleteDuplicatesOnDestination: true,
      deleteFromSource: false,
      deleteFromDestination: false,
      automap: true,
      skipCrossDuplicates: false,
      subscribeAll: true,
      dryRun: false,
      active: true,
    })
  })

  it('leaves out the mailbox for mailbox users and custom parameters when not allowed', () => {
    const body = createBody(values, { sendMailbox: false, customParamsAllowed: false })
    expect(body).not.toHaveProperty('mailbox')
    expect(body).not.toHaveProperty('customParameters')
  })
})

describe('patch', () => {
  it('holds only the changed members, the password only when typed, never the mailbox', () => {
    const values = toFormValues(job)
    expect(values.remotePassword).toBe('')
    expect(values.remotePort).toBe('993')
    expect(patchFor(job, values, { customParamsAllowed: true })).toEqual({})
    const changed = { ...values, intervalMinutes: '45', active: false, mailbox: 'x@example.org' }
    expect(patchFor(job, changed, { customParamsAllowed: true })).toEqual({
      intervalMinutes: 45,
      active: false,
    })
    expect(
      patchFor(job, { ...values, remotePassword: 'new' }, { customParamsAllowed: true }),
    ).toEqual({ remotePassword: 'new' })
    expect(
      patchFor(job, { ...values, customParameters: '--minage=2' }, { customParamsAllowed: false }),
    ).toEqual({})
  })
})

describe('client checks', () => {
  const narrow: SyncJobCapabilities = syncJobCapabilities({
    limits: {
      ...caps.limits,
      remoteHostMaxLength: 10,
      intervalMinutes: { minimum: 5, maximum: 60 },
      customParametersMaxLength: 8,
    },
  })
  const filled = {
    ...initialCreateValues(narrow, { mailbox: 'dora@example.org' }),
    remoteHost: 'imap.ex',
    remoteUser: 'dora',
    remotePassword: 'secret',
    intervalMinutes: '20',
  }

  it('passes valid values', () => {
    expect(checkValues(filled, narrow, { mode: 'create', needsMailbox: true })).toEqual({})
  })

  it('reports required fields, the owner with legacy\'s "No user defined"', () => {
    const errors = checkValues(
      {
        ...filled,
        mailbox: '',
        remoteHost: ' ',
        remoteUser: '',
        remotePassword: '',
        remotePort: '',
      },
      narrow,
      { mode: 'create', needsMailbox: true },
    )
    expect(errors.mailbox).toEqual([{ key: { legacy: 'danger.no_user_defined' } }])
    expect(errors.remoteHost).toEqual([{ key: 'validation.required' }])
    expect(errors.remotePassword).toEqual([{ key: 'validation.required' }])
    expect(errors.remotePort).toEqual([{ key: 'validation.required' }])
  })

  it('takes lengths and ranges from the capabilities', () => {
    const errors = checkValues(
      {
        ...filled,
        remoteHost: 'imap.example.org',
        intervalMinutes: '61',
        customParameters: '--maxsize=1',
      },
      narrow,
      { mode: 'create', needsMailbox: true },
    )
    expect(errors.remoteHost).toEqual([{ key: 'validation.tooLong', params: { max: '10' } }])
    expect(errors.intervalMinutes).toEqual([
      { key: 'validation.outOfRange', params: { min: '5', max: '60' } },
    ])
    expect(errors.customParameters).toEqual([{ key: 'validation.tooLong', params: { max: '8' } }])
    expect(
      checkValues({ ...filled, maxAgeDays: '1.5' }, narrow, { mode: 'create', needsMailbox: true })
        .maxAgeDays,
    ).toEqual([{ key: 'validation.outOfRange', params: { min: '0', max: '32000' } }])
  })

  it('accepts an empty password on edit and skips the owner', () => {
    expect(
      checkValues({ ...filled, mailbox: '', remotePassword: '' }, narrow, {
        mode: 'edit',
        needsMailbox: false,
      }),
    ).toEqual({})
  })
})
