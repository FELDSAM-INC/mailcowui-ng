// The parameters form of the ban service (FR-067, FR-068, plan decisions 1 and 13): legacy's one
// form, with the ban time, the maximum ban time and the retry window in seconds under the legacy
// "(s)" labels. Number fields hold text while edited. The client checks the contract's ranges (the
// limits of `src/shared/validation/limits.ts`, verified against the schema) and that the maximum
// ban time is not below the ban time; a value is checked only when it changed, so a stored value
// outside the rules never blocks a save that leaves it unchanged. Only changed values are sent.
import type { Fail2BanSettings, Fail2BanSettingsPatch } from '@/api'
import {
  F2B_ATTEMPTS_MIN,
  F2B_BAN_TIME_MIN,
  F2B_IPV4_PREFIX_MAX,
  F2B_IPV6_PREFIX_MAX,
  F2B_NUMBER_MAX,
  F2B_PREFIX_MIN,
} from '@/shared/validation/limits'

import { parseEntries } from './list-entries'

export const NUMBER_FIELDS = [
  'banTime',
  'maxBanTime',
  'maxAttempts',
  'retryWindow',
  'ipv4PrefixLength',
  'ipv6PrefixLength',
] as const
export type NumberField = (typeof NUMBER_FIELDS)[number]

export const RANGES: Record<NumberField, readonly [number, number]> = {
  banTime: [F2B_BAN_TIME_MIN, F2B_NUMBER_MAX],
  maxBanTime: [F2B_BAN_TIME_MIN, F2B_NUMBER_MAX],
  maxAttempts: [F2B_ATTEMPTS_MIN, F2B_NUMBER_MAX],
  retryWindow: [F2B_ATTEMPTS_MIN, F2B_NUMBER_MAX],
  ipv4PrefixLength: [F2B_PREFIX_MIN, F2B_IPV4_PREFIX_MAX],
  ipv6PrefixLength: [F2B_PREFIX_MIN, F2B_IPV6_PREFIX_MAX],
}

export interface ParametersForm extends Record<NumberField, string> {
  banTimeIncrement: boolean
  externallyEnforced: boolean
  /** One entry per line. */
  allowlist: string
  denylist: string
}

export type FieldError =
  | { code: 'required' }
  | { code: 'invalid' }
  | { code: 'outOfRange'; min: number; max: number }
  | { code: 'outOfRangeMinField'; min: number; max: number }

export function toParametersForm(settings: Fail2BanSettings): ParametersForm {
  return {
    banTime: String(settings.banTime),
    maxBanTime: String(settings.maxBanTime),
    banTimeIncrement: settings.banTimeIncrement,
    maxAttempts: String(settings.maxAttempts),
    retryWindow: String(settings.retryWindow),
    ipv4PrefixLength: String(settings.ipv4PrefixLength),
    ipv6PrefixLength: String(settings.ipv6PrefixLength),
    externallyEnforced: settings.externallyEnforced,
    allowlist: settings.allowlist.join('\n'),
    denylist: settings.denylist.join('\n'),
  }
}

function numberOf(text: string): number | null {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : null
}

/** The client checks of the changed numbers (FR-068). */
export function validateParameters(
  stored: Fail2BanSettings,
  form: ParametersForm,
): Partial<Record<NumberField, FieldError[]>> {
  const errors: Partial<Record<NumberField, FieldError[]>> = {}
  const value = (field: NumberField) => numberOf(form[field])
  for (const field of NUMBER_FIELDS) {
    const text = form[field].trim()
    if (text === String(stored[field])) continue
    if (text === '') errors[field] = [{ code: 'required' }]
    else if (value(field) === null) errors[field] = [{ code: 'invalid' }]
    else {
      const [min, max] = RANGES[field]
      const number = value(field)!
      if (number < min || number > max) errors[field] = [{ code: 'outOfRange', min, max }]
    }
  }
  const banTime = value('banTime')
  const maxBanTime = value('maxBanTime')
  const changed =
    form.banTime.trim() !== String(stored.banTime) ||
    form.maxBanTime.trim() !== String(stored.maxBanTime)
  if (
    changed &&
    !errors.banTime &&
    !errors.maxBanTime &&
    banTime !== null &&
    maxBanTime !== null &&
    maxBanTime < banTime
  ) {
    errors.maxBanTime = [{ code: 'outOfRangeMinField', min: banTime, max: F2B_NUMBER_MAX }]
  }
  return errors
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((entry, index) => entry === b[index])
}

/** The changed values only (FR-067). */
export function parametersPatch(
  stored: Fail2BanSettings,
  form: ParametersForm,
): Fail2BanSettingsPatch {
  const patch: Fail2BanSettingsPatch = {}
  for (const field of NUMBER_FIELDS) {
    const number = numberOf(form[field])
    if (number !== null && number !== stored[field]) patch[field] = number
  }
  if (form.banTimeIncrement !== stored.banTimeIncrement) {
    patch.banTimeIncrement = form.banTimeIncrement
  }
  if (form.externallyEnforced !== stored.externallyEnforced) {
    patch.externallyEnforced = form.externallyEnforced
  }
  const allow = parseEntries(form.allowlist).entries
  if (!sameList(allow, stored.allowlist)) patch.allowlist = allow
  const deny = parseEntries(form.denylist).entries
  if (!sameList(deny, stored.denylist)) patch.denylist = deny
  return patch
}
