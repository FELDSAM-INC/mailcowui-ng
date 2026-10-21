import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { LEGACY_TEXTS } from '@/i18n/legacy-messages'
import { duplicateLegacyMeanings, getPath, type Messages } from '../../../scripts/i18n/lib.mjs'

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Messages
const snapshot = read('src/i18n/snapshot/lang.en-gb.json')
const locales = ['en-gb', 'cs-cz', 'sk-sk']
const shared = locales.map((locale) => read(`src/i18n/messages/${locale}.json`))
const settings = locales.map((locale) => read(`src/i18n/messages/system-settings/${locale}.json`))

const auditLabels = {
  'auditLog.settings.fields.domains': 'edit.domains',
  'auditLog.settings.fields.htmlTemplate': 'admin.password_reset_tmpl_html',
  'auditLog.settings.fields.links': 'admin.app_links',
  'auditLog.settings.fields.recipients': 'admin.recipients',
  'auditLog.settings.fields.textTemplate': 'admin.password_reset_tmpl_text',
}

// These identical English phrases describe different kinds of object/action. They are not
// replacements for fields/actions in T008a's classic form map.
const distinctContexts = new Set([
  'systemSettings.massMail.message', // Compose workflow step; the actual fields retain their classic labels.
  'systemSettings.massMail.next', // Advance compose, rather than paginate a DataTables list.
  'systemSettings.massMail.statuses.running', // Delivery-job lifecycle, rather than a service/sync job.
  'emailTemplate.defaultTemplate', // Notification email content, rather than an IAM mailbox template.
])

describe('UI013 legacy label reuse (T180)', () => {
  it('uses installation labels for the same audited fields, with no copied locale values', () => {
    for (const [key, legacy] of Object.entries(auditLabels)) {
      expect(LEGACY_TEXTS[key], key).toBe(legacy)
      expect(typeof getPath(snapshot, legacy)).toBe('string')
      for (const messages of shared) expect(getPath(messages, key), key).toBeUndefined()
    }
  })

  it('uses the classic recipient label instead of a new translation in every locale', () => {
    for (const messages of settings)
      expect(getPath(messages, 'systemSettings.massMail.recipients')).toBeUndefined()
  })

  it('adds no unreviewed copies of classic wording in the settings, editor or preview messages', () => {
    const featureDuplicates = duplicateLegacyMeanings(settings[0]!, snapshot)
    const sharedDuplicates = duplicateLegacyMeanings(shared[0]!, snapshot).filter(({ key }) =>
      /^(auditLog\.settings\.|emailTemplate\.|emailPreview\.|codeEditor\.)/.test(key),
    )
    expect(
      [...featureDuplicates, ...sharedDuplicates].filter(({ key }) => !distinctContexts.has(key)),
    ).toEqual([])
  })
})
