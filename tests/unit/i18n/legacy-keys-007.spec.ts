import { expect, it } from 'vitest'
import { LEGACY_TEXTS } from '@/i18n/legacy-messages'
import snapshot from '@/i18n/snapshot/lang.en-gb.json'
import en from '@/i18n/messages/en-gb.json'
import cs from '@/i18n/messages/cs-cz.json'
import sk from '@/i18n/messages/sk-sk.json'
import { domainAdminPermissionNameValues } from '@/api'
import { getPath } from '../../../scripts/i18n/lib.mjs'

it('reuses the classic account outcomes and every permission label verbatim', () => {
  const outcomes = {
    'problem.account-exists': 'danger.object_exists',
    'problem.last-active-admin': 'warning.no_active_admin',
    'problem.cannot-delete-own-account': 'warning.cannot_delete_self',
  }
  for (const [key, legacy] of Object.entries(outcomes)) expect(LEGACY_TEXTS[key]).toBe(legacy)
  for (const flag of domainAdminPermissionNameValues) {
    const key = `permissions.flag.${flag}`
    expect(LEGACY_TEXTS[key]).toMatch(/^acl\./)
    expect(typeof getPath(snapshot, LEGACY_TEXTS[key]!)).toBe('string')
    for (const messages of [en, cs, sk]) expect(getPath(messages, key)).toBeUndefined()
  }
  for (const key of [
    ...Object.values(outcomes),
    'login.login',
    'success.logged_in_as',
    'acl.login_as',
  ]) {
    expect(typeof getPath(snapshot, key)).toBe('string')
    for (const messages of [en, cs, sk]) expect(getPath(messages, key)).toBeUndefined()
  }
})
