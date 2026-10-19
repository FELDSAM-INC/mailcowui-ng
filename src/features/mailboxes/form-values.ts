// The values of the classic add mailbox and mailbox template forms (#addMailboxModal,
// #addMailboxTemplateModal, `edit/mailbox-templates.twig`): read from a template or the built-in
// defaults (`MailboxCapabilities.templateDefaults`, G32), sent in full for a template (the stored
// template is what the form showed), for a new mailbox only where they differ from the chosen
// template, with the local part, domain, template, quota and password always (FR-025), and for an
// edited template only where they differ from the stored version.
import type {
  MailboxCreateRequest,
  MailboxRateLimit,
  MailboxTemplateDefaults,
  MailboxTemplatePatch,
  MailboxUserPermissions,
  Writable,
} from '@/api'
import { sameTagSet } from '@/shared/utils/tag-set'

import { PERMISSION_ORDER, presentPermissions } from './acl'
import { protocolsPatch } from './patch'
import { quotaMib } from './quota'
import { PROTOCOL_ORDER, type Permission, type Protocol } from './types'
import { normaliseLocalPart } from './validation'

/** What a template (or the built-in defaults) gives a new mailbox. */
export type TemplateSource = Omit<MailboxTemplateDefaults, 'userPermissions'> & {
  userPermissions: Partial<MailboxUserPermissions>
}

export interface MailboxValues {
  tags: string[]
  /** MiB as typed; "0 = ∞". */
  quota: string
  taggedMailHandling: MailboxTemplateDefaults['taggedMailHandling']
  quarantineNotification: MailboxTemplateDefaults['quarantineNotification']
  quarantineCategory: MailboxTemplateDefaults['quarantineCategory']
  tlsEnforceInbound: boolean
  tlsEnforceOutbound: boolean
  protocols: Protocol[]
  permissions: Permission[]
  /** The permissions the caller sees (domain administrators lack some, FR-042). */
  presentPermissions: Permission[]
  rateLimitValue: string
  rateLimitFrame: MailboxRateLimit['frame']
  status: MailboxTemplateDefaults['status']
  forcePasswordChange: boolean
  forceSecondFactorSetup: boolean
  webmailRedirect: boolean
}

export function valuesFrom(source: TemplateSource): MailboxValues {
  const present = presentPermissions(source.userPermissions)
  return {
    tags: [...source.tags],
    quota: quotaMib(source.quota),
    taggedMailHandling: source.taggedMailHandling,
    quarantineNotification: source.quarantineNotification,
    quarantineCategory: source.quarantineCategory,
    tlsEnforceInbound: source.tlsEnforceInbound,
    tlsEnforceOutbound: source.tlsEnforceOutbound,
    protocols: PROTOCOL_ORDER.filter((protocol) => source.protocolAccess[protocol]),
    permissions: present.filter((key) => source.userPermissions[key]),
    presentPermissions: present,
    rateLimitValue: source.rateLimit ? String(source.rateLimit.value) : '',
    rateLimitFrame: source.rateLimit?.frame ?? 'second',
    status: source.status,
    forcePasswordChange: source.forcePasswordChange,
    forceSecondFactorSetup: source.forceSecondFactorSetup,
    webmailRedirect: source.webmailRedirect,
  }
}

/** The values checked by the form: the quota in bytes and the rate limit (null for none). */
export interface CheckedValues {
  quota: number
  rateLimit: MailboxRateLimit | null
}

const permissionsOf = (values: MailboxValues): Partial<MailboxUserPermissions> =>
  Object.fromEntries(
    PERMISSION_ORDER.filter((key) => values.presentPermissions.includes(key)).map((key) => [
      key,
      values.permissions.includes(key),
    ]),
  )

const protocolsOf = (values: MailboxValues) =>
  Object.fromEntries(
    PROTOCOL_ORDER.map((protocol) => [protocol, values.protocols.includes(protocol)]),
  ) as Record<Protocol, boolean>

/** Every value the template form shows (research R14, US7-AS2). */
export function templateBody(values: MailboxValues, checked: CheckedValues) {
  return {
    quota: checked.quota,
    status: values.status,
    forcePasswordChange: values.forcePasswordChange,
    forceSecondFactorSetup: values.forceSecondFactorSetup,
    webmailRedirect: values.webmailRedirect,
    protocolAccess: protocolsOf(values),
    userPermissions: permissionsOf(values),
    tags: [...values.tags],
    taggedMailHandling: values.taggedMailHandling,
    quarantineNotification: values.quarantineNotification,
    quarantineCategory: values.quarantineCategory,
    tlsEnforceInbound: values.tlsEnforceInbound,
    tlsEnforceOutbound: values.tlsEnforceOutbound,
    rateLimit: checked.rateLimit,
  }
}

export interface CreateEssentials {
  localPart: string
  domain: string
  displayName: string
  templateId: number
  password: string
}

const sameRateLimit = (a: MailboxRateLimit | null, b: MailboxRateLimit | null) =>
  a === b || (!!a && !!b && a.value === b.value && a.frame === b.frame)

type ValuesPatch = Omit<Writable<MailboxTemplatePatch>, 'name' | 'quota'>

/** The values that differ from a template: nested members one by one, tags as a set. */
function changedValues(
  base: TemplateSource,
  values: MailboxValues,
  checked: CheckedValues,
): ValuesPatch {
  const patch: ValuesPatch = {}
  if (values.status !== base.status) patch.status = values.status
  if (values.forcePasswordChange !== base.forcePasswordChange) {
    patch.forcePasswordChange = values.forcePasswordChange
  }
  if (values.forceSecondFactorSetup !== base.forceSecondFactorSetup) {
    patch.forceSecondFactorSetup = values.forceSecondFactorSetup
  }
  if (values.webmailRedirect !== base.webmailRedirect) {
    patch.webmailRedirect = values.webmailRedirect
  }
  const protocols = protocolsPatch(base.protocolAccess, values.protocols)
  if (protocols) patch.protocolAccess = protocols
  const permissions: Partial<MailboxUserPermissions> = {}
  for (const key of values.presentPermissions) {
    const value = values.permissions.includes(key)
    if (base.userPermissions[key] !== value) permissions[key] = value
  }
  if (Object.keys(permissions).length > 0) patch.userPermissions = permissions
  if (!sameTagSet(values.tags, base.tags)) patch.tags = [...values.tags]
  if (values.taggedMailHandling !== base.taggedMailHandling) {
    patch.taggedMailHandling = values.taggedMailHandling
  }
  if (values.quarantineNotification !== base.quarantineNotification) {
    patch.quarantineNotification = values.quarantineNotification
  }
  if (values.quarantineCategory !== base.quarantineCategory) {
    patch.quarantineCategory = values.quarantineCategory
  }
  if (values.tlsEnforceInbound !== base.tlsEnforceInbound) {
    patch.tlsEnforceInbound = values.tlsEnforceInbound
  }
  if (values.tlsEnforceOutbound !== base.tlsEnforceOutbound) {
    patch.tlsEnforceOutbound = values.tlsEnforceOutbound
  }
  if (!sameRateLimit(checked.rateLimit, base.rateLimit)) patch.rateLimit = checked.rateLimit
  return patch
}

/** The create request: the essentials and only the values that differ from the template. */
export function createRequest(
  essentials: CreateEssentials,
  values: MailboxValues,
  template: TemplateSource,
  checked: CheckedValues,
): Writable<MailboxCreateRequest> {
  const request: Writable<MailboxCreateRequest> = {
    localPart: normaliseLocalPart(essentials.localPart),
    domain: essentials.domain,
    templateId: essentials.templateId,
    quota: checked.quota,
    password: essentials.password,
  }
  const displayName = essentials.displayName.trim()
  if (displayName !== '') request.displayName = displayName
  return { ...request, ...changedValues(template, values, checked) }
}

/** The merge patch of a template's edit form: only the members changed against the stored version. */
export function templatePatch(
  stored: TemplateSource & { name: string },
  name: string,
  values: MailboxValues,
  checked: CheckedValues,
): Writable<MailboxTemplatePatch> {
  const patch: Writable<MailboxTemplatePatch> = {}
  if (name.trim() !== stored.name) patch.name = name.trim()
  if (checked.quota !== stored.quota) patch.quota = checked.quota
  return { ...patch, ...changedValues(stored, values, checked) }
}
