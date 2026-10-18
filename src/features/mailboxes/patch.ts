// JSON Merge Patches of the mailbox page's sections (research R6, FR-032): only the members the
// user changed against the version the section was opened with. Nested `protocolAccess` and
// `userPermissions` carry their changed members only and are left out when none changed (their
// schemas need at least one); tags are sent whole when they differ as a set ignoring letter case;
// custom attributes are patched by name (removed or renamed names as `null`); an emptied recovery
// e-mail is `null`; the password only when one was typed.
import type {
  MailboxAuthSource,
  MailboxPatch,
  MailboxProtocolAccess,
  MailboxStatus,
  MailboxUserPermissions,
  Writable,
} from '@/api'
import { sameTagSet } from '@/shared/utils/tag-set'

import { PROTOCOL_ORDER, type Permission, type Protocol } from './types'
import type { AttributeRow } from './validation'

export type Patch = Writable<MailboxPatch>

/** The stored values the "Mailbox" section edits. */
export interface MailboxSectionBase {
  authSource: MailboxAuthSource
  displayName: string
  tags: readonly string[]
  quota: number
  recoveryEmail: string | null
  protocolAccess: MailboxProtocolAccess
  status: MailboxStatus
  forcePasswordChange: boolean
  forceSecondFactorSetup: boolean
  webmailRedirect: boolean
}

/** The section's form, with the quota already in bytes. */
export interface MailboxSectionValues {
  authSource: MailboxAuthSource
  displayName: string
  tags: readonly string[]
  quota: number
  password: string
  recoveryEmail: string
  protocols: readonly Protocol[]
  status: MailboxStatus
  forcePasswordChange: boolean
  forceSecondFactorSetup: boolean
  webmailRedirect: boolean
}

export type SectionField = keyof Patch

export function protocolsPatch(
  stored: MailboxProtocolAccess,
  selected: readonly Protocol[],
): Partial<MailboxProtocolAccess> | null {
  const patch: Partial<MailboxProtocolAccess> = {}
  for (const protocol of PROTOCOL_ORDER) {
    const value = selected.includes(protocol)
    if (stored[protocol] !== value) patch[protocol] = value
  }
  return Object.keys(patch).length > 0 ? patch : null
}

/** The changed members among the permissions present (the ones the caller sees). */
export function permissionsPatch(
  stored: Partial<MailboxUserPermissions>,
  selected: readonly Permission[],
): Partial<MailboxUserPermissions> | null {
  const patch: Partial<MailboxUserPermissions> = {}
  for (const key of Object.keys(stored) as Permission[]) {
    const value = selected.includes(key)
    if (stored[key] !== value) patch[key] = value
  }
  return Object.keys(patch).length > 0 ? patch : null
}

export function mailboxPatch(
  base: MailboxSectionBase,
  values: MailboxSectionValues,
  editable: (field: SectionField) => boolean = () => true,
): Patch {
  const patch: Patch = {}
  const set = <K extends SectionField>(field: K, value: Patch[K]) => {
    if (editable(field)) patch[field] = value
  }
  if (values.authSource !== base.authSource) set('authSource', values.authSource)
  if (values.displayName !== base.displayName) set('displayName', values.displayName)
  if (!sameTagSet(values.tags, base.tags)) set('tags', [...values.tags])
  if (values.quota !== base.quota) set('quota', values.quota)
  if (values.password !== '') set('password', values.password)
  const recovery = values.recoveryEmail.trim()
  if (recovery !== (base.recoveryEmail ?? ''))
    set('recoveryEmail', recovery === '' ? null : recovery)
  const protocols = protocolsPatch(base.protocolAccess, values.protocols)
  if (protocols) set('protocolAccess', protocols)
  if (values.status !== base.status) set('status', values.status)
  if (values.forcePasswordChange !== base.forcePasswordChange) {
    set('forcePasswordChange', values.forcePasswordChange)
  }
  if (values.forceSecondFactorSetup !== base.forceSecondFactorSetup) {
    set('forceSecondFactorSetup', values.forceSecondFactorSetup)
  }
  if (values.webmailRedirect !== base.webmailRedirect) {
    set('webmailRedirect', values.webmailRedirect)
  }
  return patch
}

/** Added and changed names with their value; removed and renamed stored names as `null`. */
export function attributesPatch(
  stored: Readonly<Record<string, string>>,
  rows: readonly AttributeRow[],
): Record<string, string | null> | null {
  const patch: Record<string, string | null> = {}
  const kept = new Set<string>()
  for (const row of rows) {
    const name = row.name.trim()
    kept.add(name)
    if (stored[name] !== row.value) patch[name] = row.value
  }
  for (const name of Object.keys(stored)) {
    if (!kept.has(name)) patch[name] = null
  }
  return Object.keys(patch).length > 0 ? patch : null
}
