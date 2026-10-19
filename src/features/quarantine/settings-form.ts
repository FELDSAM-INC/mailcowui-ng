// The quarantine settings form (UI 006 US7, FR-059 to FR-063, data-model §7, legacy form map screen
// 8, D11, D14): the stored values as the form shows them, the client checks, and the merge patch of
// the changed members. Sizes are entered in MiB, as legacy does, and sent in bytes (× the
// capabilities' `maxMessageSizeStep`). A sender or subject that is the default shows an empty
// field with the value that applies as its placeholder; emptying a field that has a default sends
// `null` and restores it, the template included (D14: "Leave empty to restore default template").
import type {
  QuarantineCapabilities,
  QuarantineReleaseFormat,
  QuarantineSettings,
  QuarantineSettingsPatch,
} from '@/api'
import { fromTenths, toTenths } from '@/i18n/parse'
import { add, type ClientErrors } from '@/shared/validation/client-errors'
import { utf8ByteLength } from '@/shared/validation/utf8'

export type SettingsLimits = QuarantineCapabilities['settings']

export interface SettingsForm {
  retentionPerMailbox: number | null
  /** MiB. */
  maxMessageSize: number | null
  /** Tenths; null when empty (9999.0 applies). */
  notificationScoreLimit: number | null
  maxAgeDays: number | null
  redirectRecipient: string
  copyRecipient: string
  /** Empty when the default applies. */
  notificationSender: string
  notificationSubject: string
  releaseFormat: QuarantineReleaseFormat
  excludedDomains: string[]
  notificationTemplate: string
}

/** The members of the form, in legacy order (screen 8). */
export const SETTINGS_FIELDS = [
  'retentionPerMailbox',
  'maxMessageSize',
  'notificationScoreLimit',
  'maxAgeDays',
  'redirectRecipient',
  'copyRecipient',
  'notificationSender',
  'notificationSubject',
  'releaseFormat',
  'excludedDomains',
  'notificationTemplate',
] as const satisfies readonly (keyof SettingsForm & keyof QuarantineSettingsPatch)[]

export type SettingsField = (typeof SETTINGS_FIELDS)[number]

/** A size in bytes as whole MiB of the step (rounded down: the API stores whole multiples). */
export const bytesToMib = (bytes: number, step: number) => Math.floor(bytes / step)
export const mibToBytes = (mib: number, step: number) => mib * step

export function toSettingsForm(settings: QuarantineSettings, step: number): SettingsForm {
  return {
    retentionPerMailbox: settings.retentionPerMailbox,
    maxMessageSize: bytesToMib(settings.maxMessageSize, step),
    notificationScoreLimit:
      settings.notificationScoreLimit === null || settings.notificationScoreLimit === undefined
        ? null
        : toTenths(settings.notificationScoreLimit),
    maxAgeDays: settings.maxAgeDays ?? null,
    redirectRecipient: settings.redirectRecipient ?? '',
    copyRecipient: settings.copyRecipient ?? '',
    notificationSender: settings.notificationSenderIsDefault
      ? ''
      : (settings.notificationSender ?? ''),
    notificationSubject: settings.notificationSubjectIsDefault
      ? ''
      : (settings.notificationSubject ?? ''),
    releaseFormat: settings.releaseFormat ?? 'original',
    excludedDomains: [...(settings.excludedDomains ?? [])],
    notificationTemplate: settings.notificationTemplate ?? '',
  }
}

const emptyToNull = (value: string) => (value.trim() === '' ? null : value.trim())

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a.map((item) => item.toLowerCase()))
  const right = new Set(b.map((item) => item.toLowerCase()))
  return left.size === right.size && [...left].every((item) => right.has(item))
}

/** The members the user changed against the form as it was opened, in the API's units. */
export function settingsPatch(
  opened: SettingsForm,
  form: SettingsForm,
  step: number,
): QuarantineSettingsPatch {
  const patch: QuarantineSettingsPatch = {}
  if (form.retentionPerMailbox !== opened.retentionPerMailbox && form.retentionPerMailbox !== null) {
    patch.retentionPerMailbox = form.retentionPerMailbox
  }
  if (form.maxMessageSize !== opened.maxMessageSize && form.maxMessageSize !== null) {
    patch.maxMessageSize = mibToBytes(form.maxMessageSize, step)
  }
  if (form.notificationScoreLimit !== opened.notificationScoreLimit) {
    patch.notificationScoreLimit =
      form.notificationScoreLimit === null ? null : fromTenths(form.notificationScoreLimit)
  }
  if (form.maxAgeDays !== opened.maxAgeDays && form.maxAgeDays !== null) {
    patch.maxAgeDays = form.maxAgeDays
  }
  for (const field of [
    'redirectRecipient',
    'copyRecipient',
    'notificationSender',
    'notificationSubject',
  ] as const) {
    if (emptyToNull(form[field]) !== emptyToNull(opened[field])) {
      patch[field] = emptyToNull(form[field])
    }
  }
  if (form.releaseFormat !== opened.releaseFormat) patch.releaseFormat = form.releaseFormat
  if (!sameSet(form.excludedDomains, opened.excludedDomains)) {
    patch.excludedDomains = [...form.excludedDomains]
  }
  if (form.notificationTemplate !== opened.notificationTemplate) {
    // D14: an empty template restores the default.
    patch.notificationTemplate =
      form.notificationTemplate.trim() === '' ? null : form.notificationTemplate
  }
  return patch
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const ADDRESS_MAX_LENGTH = 255

export interface SettingsFormatters {
  number: (value: number) => string
  /** A size in bytes, exact (for the template limit). */
  bytes: (value: number) => string
}

/**
 * The client checks of data-model §7; the server's are final. LocaleNumberField reports text that
 * is not a number itself (`valid`).
 */
export function validateSettings(
  form: SettingsForm,
  limits: SettingsLimits,
  format: SettingsFormatters,
): ClientErrors {
  const errors: ClientErrors = {}
  const range = (field: SettingsField, value: number | null, min: number, max: number) => {
    if (value === null) {
      add(errors, field, { key: 'validation.required' })
    } else if (value < min || value > max) {
      add(errors, field, {
        key: 'validation.outOfRange',
        params: { min: format.number(min), max: format.number(max) },
      })
    }
  }
  range('retentionPerMailbox', form.retentionPerMailbox, 0, limits.maxRetentionPerMailbox)
  range(
    'maxMessageSize',
    form.maxMessageSize,
    0,
    bytesToMib(limits.maxMessageSize, limits.maxMessageSizeStep),
  )
  range('maxAgeDays', form.maxAgeDays, limits.maxAgeDays.min, limits.maxAgeDays.max)
  for (const field of ['redirectRecipient', 'copyRecipient', 'notificationSender'] as const) {
    const value = form[field].trim()
    if (value && (value.length > ADDRESS_MAX_LENGTH || !EMAIL.test(value))) {
      add(errors, field, { key: 'validation.format.email' })
    }
  }
  if (Array.from(form.notificationSubject.trim()).length > limits.notificationSubjectMaxLength) {
    add(errors, 'notificationSubject', {
      key: 'validation.tooLong',
      params: { max: format.number(limits.notificationSubjectMaxLength) },
    })
  }
  if (utf8ByteLength(form.notificationTemplate) > limits.notificationTemplateMaxBytes) {
    add(errors, 'notificationTemplate', {
      key: 'validation.tooLongBytes',
      params: { max: format.bytes(limits.notificationTemplateMaxBytes) },
    })
  }
  return errors
}
