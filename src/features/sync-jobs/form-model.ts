// The sync-job form (UI 008 research R10, R11, data-model §2, §6, plan legacy form map). One form
// in the classic add form's order, used by the create page and the job page's section. Values are
// derived from the generated create request (constitution I), with numbers held as typed text. The
// initial values, limits and the custom-parameter permission come from the capabilities read
// (FR-055); only the IMAP standard ports are constants (FR-019).
import type {
  SyncJob,
  SyncJobCapabilities,
  SyncJobCreateRequest,
  SyncJobEncryption,
  SyncJobRange,
} from '@/api'
import { legacy, type TextRef } from '@/i18n'

import type { SyncJobCreateBody, SyncJobPatchBody } from './api'

type Config = Required<Omit<SyncJobCreateRequest, 'mailbox' | 'remotePassword'>>

export const NUMBER_FIELDS = [
  'remotePort',
  'intervalMinutes',
  'maxAgeDays',
  'maxBytesPerSecond',
  'remoteTimeoutSeconds',
  'localTimeoutSeconds',
] as const satisfies readonly (keyof Config)[]
export type NumberField = (typeof NUMBER_FIELDS)[number]

/** The form's values: numbers as typed text, the target mailbox and the typed password as text. */
export type SyncJobFormValues = {
  [K in keyof Config]: K extends NumberField ? string : Config[K]
} & { mailbox: string; remotePassword: string }

export type FormField = Exclude<keyof SyncJobFormValues, 'mailbox'>

/** The fields in the order of the classic add form and edit page (after the owner). */
export const FIELD_ORDER = [
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
] as const satisfies readonly FormField[]

export const BOOLEAN_FIELDS = [
  'deleteDuplicatesOnDestination',
  'deleteFromSource',
  'deleteFromDestination',
  'automap',
  'skipCrossDuplicates',
  'subscribeAll',
  'dryRun',
  'active',
] as const satisfies readonly FormField[]
export type BooleanField = (typeof BOOLEAN_FIELDS)[number]

/** The imapsync option the classic labels append, as literals (FR-025). */
export const OPTION_NAMES: Partial<Record<BooleanField, string>> = {
  deleteDuplicatesOnDestination: '--delete2duplicates',
  deleteFromSource: '--delete1',
  deleteFromDestination: '--delete2',
  automap: '--automap',
  skipCrossDuplicates: '--skipcrossduplicates',
  subscribeAll: '--subscribeall',
  dryRun: '--dry',
}

/** The capability range of each number field. */
export const RANGE_OF: Record<NumberField, keyof SyncJobCapabilities['limits']> = {
  remotePort: 'remotePort',
  intervalMinutes: 'intervalMinutes',
  maxAgeDays: 'maxAgeDays',
  maxBytesPerSecond: 'maxBytesPerSecond',
  remoteTimeoutSeconds: 'remoteTimeoutSeconds',
  localTimeoutSeconds: 'localTimeoutSeconds',
}

const LENGTH_OF = {
  remoteHost: 'remoteHostMaxLength',
  remoteUser: 'remoteUserMaxLength',
  remotePassword: 'remotePasswordMaxLength',
  destinationSubfolder: 'destinationSubfolderMaxLength',
  exclude: 'excludeMaxLength',
  customParameters: 'customParametersMaxLength',
} as const satisfies Partial<Record<FormField, keyof SyncJobCapabilities['limits']>>

export type TextField = keyof typeof LENGTH_OF

export function rangeOf(caps: SyncJobCapabilities, field: NumberField): SyncJobRange {
  return caps.limits[RANGE_OF[field]] as SyncJobRange
}

export function maxLengthOf(caps: SyncJobCapabilities, field: TextField): number {
  return caps.limits[LENGTH_OF[field]]
}

/** The IMAP standard port of an encryption: a protocol constant, not a server limit. */
export function standardPort(encryption: SyncJobEncryption): number {
  return encryption === 'ssl' ? 993 : 143
}

/**
 * The port after an encryption change (FR-019): it follows while the user has not typed into it
 * and it still holds the previous encryption's standard port (or nothing).
 */
export function nextPort(change: {
  port: string
  from: SyncJobEncryption
  to: SyncJobEncryption
  touched: boolean
}): string {
  const { port, from, to, touched } = change
  if (touched) return port
  if (port.trim() === '' || port.trim() === String(standardPort(from))) {
    return String(standardPort(to))
  }
  return port
}

/** The create form's first values: the capabilities' defaults (FR-018) and the standard port. */
export function initialCreateValues(
  caps: SyncJobCapabilities,
  options: { mailbox?: string },
): SyncJobFormValues {
  const d = caps.defaults
  return {
    mailbox: options.mailbox ?? '',
    remoteHost: '',
    remotePort: String(standardPort(d.encryption)),
    remoteUser: '',
    remotePassword: '',
    encryption: d.encryption,
    intervalMinutes: String(d.intervalMinutes),
    destinationSubfolder: d.destinationSubfolder,
    maxAgeDays: String(d.maxAgeDays),
    maxBytesPerSecond: String(d.maxBytesPerSecond),
    remoteTimeoutSeconds: String(d.remoteTimeoutSeconds),
    localTimeoutSeconds: String(d.localTimeoutSeconds),
    exclude: d.exclude,
    customParameters: d.customParameters,
    deleteDuplicatesOnDestination: d.deleteDuplicatesOnDestination,
    deleteFromSource: d.deleteFromSource,
    deleteFromDestination: d.deleteFromDestination,
    automap: d.automap,
    skipCrossDuplicates: d.skipCrossDuplicates,
    subscribeAll: d.subscribeAll,
    dryRun: d.dryRun,
    active: d.active,
  }
}

/** A stored job as form values; the password field starts empty (FR-030). */
export function toFormValues(job: SyncJob): SyncJobFormValues {
  return {
    mailbox: job.mailbox,
    remoteHost: job.remoteHost,
    remotePort: String(job.remotePort),
    remoteUser: job.remoteUser,
    remotePassword: '',
    encryption: job.encryption,
    intervalMinutes: String(job.intervalMinutes),
    destinationSubfolder: job.destinationSubfolder,
    maxAgeDays: String(job.maxAgeDays),
    maxBytesPerSecond: String(job.maxBytesPerSecond),
    remoteTimeoutSeconds: String(job.remoteTimeoutSeconds),
    localTimeoutSeconds: String(job.localTimeoutSeconds),
    exclude: job.exclude,
    customParameters: job.customParameters,
    deleteDuplicatesOnDestination: job.deleteDuplicatesOnDestination,
    deleteFromSource: job.deleteFromSource,
    deleteFromDestination: job.deleteFromDestination,
    automap: job.automap,
    skipCrossDuplicates: job.skipCrossDuplicates,
    subscribeAll: job.subscribeAll,
    dryRun: job.dryRun,
    active: job.active,
  }
}

/** A whole number typed as text, or null. */
export function parseWhole(text: string): number | null {
  const value = text.trim()
  return /^-?\d+$/.test(value) ? Number(value) : null
}

type Values = Omit<SyncJobCreateBody, 'mailbox'>

/** Every member as the API expects it: trimmed text where the API trims, integers for numbers. */
function toRequestValues(values: SyncJobFormValues): Values {
  const number = (field: NumberField) => parseWhole(values[field]) ?? 0
  return {
    remoteHost: values.remoteHost.trim(),
    remotePort: number('remotePort'),
    encryption: values.encryption,
    remoteUser: values.remoteUser,
    remotePassword: values.remotePassword,
    intervalMinutes: number('intervalMinutes'),
    destinationSubfolder: values.destinationSubfolder,
    maxAgeDays: number('maxAgeDays'),
    maxBytesPerSecond: number('maxBytesPerSecond'),
    remoteTimeoutSeconds: number('remoteTimeoutSeconds'),
    localTimeoutSeconds: number('localTimeoutSeconds'),
    exclude: values.exclude,
    customParameters: values.customParameters.trim(),
    deleteDuplicatesOnDestination: values.deleteDuplicatesOnDestination,
    deleteFromSource: values.deleteFromSource,
    deleteFromDestination: values.deleteFromDestination,
    automap: values.automap,
    skipCrossDuplicates: values.skipCrossDuplicates,
    subscribeAll: values.subscribeAll,
    dryRun: values.dryRun,
    active: values.active,
  }
}

/**
 * The create body: every member, as the user saw it. The mailbox is left out for mailbox users
 * (their job always targets their own mailbox), custom parameters when the caller may not set them.
 */
export function createBody(
  values: SyncJobFormValues,
  options: { sendMailbox: boolean; customParamsAllowed: boolean },
): SyncJobCreateBody {
  const { customParameters, ...rest } = toRequestValues(values)
  return {
    ...(options.sendMailbox ? { mailbox: values.mailbox.trim() } : {}),
    ...rest,
    ...(options.customParamsAllowed ? { customParameters } : {}),
  }
}

/**
 * The patch of a save (FR-026): only the members whose value differs from the loaded job; the
 * password only when typed; never the mailbox; custom parameters never when not allowed.
 */
export function patchFor(
  job: SyncJob,
  values: SyncJobFormValues,
  options: { customParamsAllowed: boolean },
): SyncJobPatchBody {
  const next = toRequestValues(values)
  const patch: Record<string, unknown> = {}
  for (const field of FIELD_ORDER) {
    if (field === 'remotePassword') continue
    if (field === 'customParameters' && !options.customParamsAllowed) continue
    if (next[field] !== job[field]) patch[field] = next[field]
  }
  if (values.remotePassword !== '') patch.remotePassword = values.remotePassword
  return patch
}

/** A client-side error: a new string or one of mailcow's messages, with its parameters. */
export interface ClientError {
  key: TextRef
  params?: Record<string, number>
}

export type ClientErrors = Partial<Record<keyof SyncJobFormValues, ClientError[]>>

/**
 * The checks before sending (FR-021, data-model §6): required fields, lengths and whole numbers
 * within the capabilities' ranges. Host format, the pattern and the custom options are left to the
 * API, which is authoritative.
 */
export function checkValues(
  values: SyncJobFormValues,
  caps: SyncJobCapabilities,
  options: { mode: 'create' | 'edit'; needsMailbox: boolean; customParamsAllowed?: boolean },
): ClientErrors {
  const errors: ClientErrors = {}
  const add = (field: keyof SyncJobFormValues, error: ClientError) => {
    ;(errors[field] ??= []).push(error)
  }
  if (options.needsMailbox && values.mailbox.trim() === '') {
    add('mailbox', { key: legacy('danger.no_user_defined') })
  }
  const required: TextField[] = ['remoteHost', 'remoteUser']
  if (options.mode === 'create') required.push('remotePassword')
  for (const field of required) {
    if (values[field].trim() === '') add(field, { key: 'validation.required' })
  }
  for (const field of Object.keys(LENGTH_OF) as TextField[]) {
    if (field === 'customParameters' && options.customParamsAllowed === false) continue
    const value = field === 'remoteHost' ? values[field].trim() : values[field]
    const max = maxLengthOf(caps, field)
    if (!errors[field] && value.length > max)
      add(field, { key: 'validation.tooLong', params: { max } })
  }
  for (const field of NUMBER_FIELDS) {
    const text = values[field]
    if (text.trim() === '') {
      add(field, { key: 'validation.required' })
      continue
    }
    const value = parseWhole(text)
    const range = rangeOf(caps, field)
    if (value === null || value < range.minimum || value > range.maximum) {
      add(field, {
        key: 'validation.outOfRange',
        params: { min: range.minimum, max: range.maximum },
      })
    }
  }
  return errors
}
