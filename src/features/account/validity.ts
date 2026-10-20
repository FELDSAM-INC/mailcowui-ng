import type { SelfServiceCapabilities, TemporaryAliasPatch } from '@/api'
import { lt, type LegacyKey } from '@/i18n'

// The current contract fixes these values; numeric inputs keep the range algorithm testable.
export type AliasValidityLimits = {
  [K in keyof NonNullable<SelfServiceCapabilities['temporaryAliases']>]: number
}
export type AliasValidity = '1' | '24' | '168' | '744' | '8760' | '87600' | 'permanent'
const presets: { value: AliasValidity; count: number; label: LegacyKey }[] = [
  { value: '1', count: 1, label: 'user.hour' },
  { value: '24', count: 1, label: 'user.day' },
  { value: '168', count: 1, label: 'user.week' },
  { value: '744', count: 1, label: 'user.month' },
  { value: '8760', count: 1, label: 'user.year' },
  { value: '87600', count: 10, label: 'user.years' },
  { value: 'permanent', count: 0, label: 'user.expire_never' },
]
export function validityPresets(limits: AliasValidityLimits) {
  return presets.filter(
    ({ value }) =>
      value === 'permanent' ||
      (Number(value) >= limits.minLifetimeHours && Number(value) <= limits.maxLifetimeHours),
  )
}
export function defaultValidity(limits: AliasValidityLimits): AliasValidity {
  const choices = validityPresets(limits)
  return (
    choices.find(({ value }) => value === String(limits.defaultLifetimeHours))?.value ??
    choices[0]!.value
  )
}
export function validityLabel(value: AliasValidity, action = false): string {
  const preset = presets.find((item) => item.value === value)!
  return value === 'permanent'
    ? lt(preset.label)
    : `${action ? `${lt('user.expire_in')} ` : ''}${preset.count} ${lt(preset.label)}`
}
export function validityPatch(value: AliasValidity): TemporaryAliasPatch {
  return value === 'permanent' ? { permanent: true } : { lifetimeHours: Number(value) }
}
