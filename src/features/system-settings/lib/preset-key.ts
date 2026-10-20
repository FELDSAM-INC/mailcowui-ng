import type { LegacyKey } from '@/i18n'
const keys = [
  'admin.rsettings_preset_1',
  'admin.rsettings_preset_2',
  'admin.rsettings_preset_3',
  'admin.rsettings_preset_4',
  'mailbox.sieve_preset_1',
  'mailbox.sieve_preset_2',
  'mailbox.sieve_preset_3',
  'mailbox.sieve_preset_4',
  'mailbox.sieve_preset_5',
  'mailbox.sieve_preset_6',
  'mailbox.sieve_preset_7',
  'mailbox.sieve_preset_8',
] as const satisfies readonly LegacyKey[]
export function presetKey(value: string | null): LegacyKey | null {
  return keys.find((key) => key === value) ?? null
}
