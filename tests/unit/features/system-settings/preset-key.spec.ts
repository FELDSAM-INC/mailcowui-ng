import { describe, expect, it } from 'vitest'
import { presetKey } from '@/features/system-settings/lib/preset-key'

describe('trusted legacy preset keys', () => {
  it('accepts known Rspamd/Sieve preset keys only, never arbitrary server-supplied translation paths', () => {
    expect(presetKey('admin.rsettings_preset_4')).toBe('admin.rsettings_preset_4')
    expect(presetKey('mailbox.sieve_preset_8')).toBe('mailbox.sieve_preset_8')
    expect(presetKey('admin.rsettings_preset_999')).toBeNull()
    expect(presetKey('mailbox.sieve_preset_header')).toBeNull()
    expect(presetKey('admin.password')).toBeNull()
    expect(presetKey(null)).toBeNull()
  })
})
