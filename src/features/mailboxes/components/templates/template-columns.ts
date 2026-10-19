// The columns of the mailbox template list, as the classic list has them (FR-058,
// `js/site/mailbox.js` draw_templates_mbox_table): quota, TLS in and out, the six protocols, SOGo
// and forced 2FA, each with the width from which the table shows it as a column (narrower tables
// show it in the entry's details, as the classic responsive table does). ID, template, active and
// the actions are always columns; the quarantine settings, forced password update, rate limit and
// tags are always in the details (legacy's `none` columns). The protocol headers are hard-coded in
// legacy.
import { lt } from '@/i18n'

import type { MailboxTemplate, Protocol } from '../../types'

interface Format {
  quota(bytes: number): string
  yesNo(value: boolean): string
}

/** Legacy's column order of the protocols. */
export const COLUMN_PROTOCOLS: readonly Protocol[] = [
  'smtp',
  'imap',
  'pop3',
  'sieve',
  'activeSync',
  'dav',
]

export const protocolColumnKey = (key: Protocol | 'webmailRedirect') =>
  `mailboxTemplates.column.${key}`

export interface TemplateColumn {
  key:
    | 'quota'
    | 'tlsEnforceInbound'
    | 'tlsEnforceOutbound'
    | Protocol
    | 'webmailRedirect'
    | 'forceSecondFactorSetup'
  label: string
  /** md: always a column; xl and 2xl: a column from that width, else in the details. */
  from: 'md' | 'xl' | '2xl'
  value: (template: MailboxTemplate) => string
}

export function templateColumns(format: Format, t: (key: string) => string): TemplateColumn[] {
  return [
    {
      key: 'quota',
      label: lt('mailbox.domain_quota'),
      from: 'md',
      value: (item) => format.quota(item.quota),
    },
    {
      key: 'tlsEnforceInbound',
      label: lt('mailbox.tls_enforce_in'),
      from: 'xl',
      value: (item) => format.yesNo(item.tlsEnforceInbound),
    },
    {
      key: 'tlsEnforceOutbound',
      label: lt('mailbox.tls_enforce_out'),
      from: 'xl',
      value: (item) => format.yesNo(item.tlsEnforceOutbound),
    },
    ...COLUMN_PROTOCOLS.map((protocol): TemplateColumn => ({
      key: protocol,
      label: t(protocolColumnKey(protocol)),
      from: '2xl',
      value: (item) => format.yesNo(item.protocolAccess[protocol]),
    })),
    {
      key: 'webmailRedirect',
      label: t(protocolColumnKey('webmailRedirect')),
      from: '2xl',
      value: (item) => format.yesNo(item.webmailRedirect),
    },
    {
      key: 'forceSecondFactorSetup',
      label: lt('mailbox.force_tfa'),
      from: 'xl',
      value: (item) => format.yesNo(item.forceSecondFactorSetup),
    },
  ]
}
