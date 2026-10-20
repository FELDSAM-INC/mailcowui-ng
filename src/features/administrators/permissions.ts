import {
  domainAdminPermissionNameValues,
  type DomainAdminPermissionName,
  type DomainAdminPermissions,
  type DomainAdminPermissionsPatch,
} from '@/api'
import { legacy, type LegacyRef } from '@/i18n'

/** The upstream da_acl field order; the generated enum keeps the same stable order. */
export const permissionOrder = domainAdminPermissionNameValues
export const permissionLabels = {
  syncjobs: legacy('acl.syncjobs'),
  quarantine: legacy('acl.quarantine'),
  loginAs: legacy('acl.login_as'),
  sogoAccess: legacy('acl.sogo_access'),
  appPasswds: legacy('acl.app_passwds'),
  bccMaps: legacy('acl.bcc_maps'),
  pushover: legacy('acl.pushover'),
  filters: legacy('acl.filters'),
  ratelimit: legacy('acl.ratelimit'),
  spamPolicy: legacy('acl.spam_policy'),
  extendSenderAcl: legacy('acl.extend_sender_acl'),
  unlimitedQuota: legacy('acl.unlimited_quota'),
  protocolAccess: legacy('acl.protocol_access'),
  smtpIpAccess: legacy('acl.smtp_ip_access'),
  aliasDomains: legacy('acl.alias_domains'),
  mailboxRelayhost: legacy('acl.mailbox_relayhost'),
  domainRelayhost: legacy('acl.domain_relayhost'),
  domainDesc: legacy('acl.domain_desc'),
  aliasExternalGoto: legacy('acl.alias_external_goto'),
} satisfies Record<DomainAdminPermissionName, LegacyRef>

export function changedFlags(
  base: DomainAdminPermissions,
  current: DomainAdminPermissions,
): DomainAdminPermissionsPatch {
  return Object.fromEntries(
    permissionOrder
      .filter((name) => base[name] !== current[name])
      .map((name) => [name, current[name]]),
  )
}
