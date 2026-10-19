// The own mailbox overview of the mock (UI 005 T011, research R20): UI 003's stored mailbox plus the
// addresses and counts only the self-service record holds.
import type { MailboxOverview } from '@/api'

import { readableName } from './domain'
import { addressOf } from './mailbox'
import { isLive } from './temporary-alias'
import type { MockMailbox, ScenarioState } from '../scenarios/state'
import { mailboxSelfService } from '../scenarios/self-service/state'

export function mailboxOverview(state: ScenarioState, mailbox: MockMailbox): MailboxOverview {
  const address = addressOf(mailbox)
  const record = mailboxSelfService(state, address)
  const now = state.now()
  return {
    address,
    localPart: mailbox.localPart,
    domain: mailbox.domain,
    domainUnicode: readableName(mailbox.domain),
    displayName: mailbox.displayName,
    authSource: mailbox.authSource,
    quota: {
      quotaBytes: mailbox.quota,
      usedBytes: mailbox.quotaUsed,
      messages: mailbox.messageCount,
      percentUsed:
        mailbox.quota === 0 ? null : Math.round((mailbox.quotaUsed / mailbox.quota) * 100),
    },
    protocolAccess: { ...mailbox.protocolAccess },
    webmail: {
      enabled: state.selfService.groupwareEnabled,
      redirectAfterSignIn: mailbox.webmailRedirect,
    },
    passwordChangedAt: mailbox.passwordChangedAt,
    recoveryEmail: mailbox.authSource === 'mailcow' ? mailbox.recoveryEmail : null,
    directAliases: record.directAliases.map((item) => ({ ...item })),
    sharedAliases: record.sharedAliases.map((item) => ({ ...item })),
    aliasDomainAddresses: record.aliasDomainAddresses.map((item) => ({ ...item })),
    sendAs: {
      addresses: [...record.sendAs.addresses],
      domains: [...record.sendAs.domains],
      anyAddress: record.sendAs.anyAddress,
    },
    catchAllAddresses: [...record.catchAllAddresses],
    temporaryAliasDomains: [mailbox.domain, ...record.temporaryAliasDomains],
    activeAppPasswords: record.appPasswords.filter((item) => item.active).length,
    activeTemporaryAliases: record.temporaryAliases.filter((item) => isLive(item, now)).length,
    pushNotificationsActive: record.push?.active ?? false,
  }
}
