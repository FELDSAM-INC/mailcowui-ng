import { describe, expect, it } from 'vitest'
import {
  settingsPatch,
  toSettingsForm,
  validateSettings,
} from '@/features/quarantine/settings-form'
import { defaultQuarantineCapabilities } from '../../../mocks/factories/quarantine-capabilities'
import {
  customQuarantineSettings,
  quarantineSettingsView,
} from '../../../mocks/factories/quarantine-settings'

const caps = defaultQuarantineCapabilities().settings
const format = { number: String, bytes: String }
const form = () =>
  toSettingsForm(
    quarantineSettingsView(customQuarantineSettings(), 'full', new Set()),
    caps.maxMessageSizeStep,
  )

describe('quarantine settings patch', () => {
  it('omits unchanged fields, converts MiB and decimal scores, and resets empty defaultable fields', () => {
    const opened = form()
    expect(settingsPatch(opened, { ...opened }, caps.maxMessageSizeStep)).toEqual({})
    expect(
      settingsPatch(
        opened,
        {
          ...opened,
          maxMessageSize: 12,
          notificationScoreLimit: 75,
          notificationTemplate: '',
          notificationSender: '',
        },
        caps.maxMessageSizeStep,
      ),
    ).toEqual({
      maxMessageSize: 12 * 1024 * 1024,
      notificationScoreLimit: 7.5,
      notificationTemplate: null,
      notificationSender: null,
    })
  })
  it('treats excluded domains as a set and validates retention and addresses', () => {
    const opened = { ...form(), excludedDomains: ['a.example', 'b.example'] }
    expect(
      settingsPatch(
        opened,
        { ...opened, excludedDomains: ['b.example', 'a.example'] },
        caps.maxMessageSizeStep,
      ),
    ).toEqual({})
    const errors = validateSettings(
      { ...opened, retentionPerMailbox: -1, redirectRecipient: 'broken' },
      caps,
      format,
    )
    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining(['retentionPerMailbox', 'redirectRecipient']),
    )
  })
  it('counts template bytes, including multi-byte Unicode', () => {
    const value = {
      ...form(),
      notificationTemplate: 'ž'.repeat(Math.floor(caps.notificationTemplateMaxBytes / 2) + 1),
    }
    expect(validateSettings(value, caps, format)).toHaveProperty('notificationTemplate')
  })
})
