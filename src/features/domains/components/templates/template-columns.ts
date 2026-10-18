// The columns of the template list, as the classic list has them (FR-050, `js/site/mailbox.js`
// draw_templates_domain_table): ID, template, the limits, the quotas, the Global Address List, the
// relay options and the active state, each with the width from which the table shows it as a
// column (narrower tables show it in the entry's details, as the classic responsive table does).
import { lt } from '@/i18n'
import type { DomainTemplate } from '@/api'

interface Format {
  count(value: number): string
  size(bytes: number): string
  yesNo(value: boolean): string
}

export interface TemplateColumn {
  key:
    | 'maxAliases'
    | 'maxMailboxes'
    | 'maxMailboxQuota'
    | 'domainQuota'
    | 'globalAddressList'
    | 'backupMx'
    | 'relayAllRecipients'
    | 'relayUnknownOnly'
    | 'active'
  label: string
  /** md: always a column; xl and 2xl: a column from that width, else in the details. */
  from: 'md' | 'xl' | '2xl'
  value: (template: DomainTemplate) => string
}

export function templateColumns(format: Format): TemplateColumn[] {
  return [
    {
      key: 'maxAliases',
      label: lt('mailbox.max_aliases'),
      from: 'md',
      value: (item) => format.count(item.maxAliases),
    },
    {
      key: 'maxMailboxes',
      label: lt('mailbox.max_mailboxes'),
      from: 'md',
      value: (item) => format.count(item.maxMailboxes),
    },
    {
      key: 'maxMailboxQuota',
      label: lt('mailbox.max_quota'),
      from: 'xl',
      value: (item) => format.size(item.maxMailboxQuota),
    },
    {
      key: 'domainQuota',
      label: lt('mailbox.domain_quota_total'),
      from: 'xl',
      value: (item) => format.size(item.domainQuota),
    },
    {
      key: 'globalAddressList',
      label: lt('mailbox.gal'),
      from: '2xl',
      value: (item) => format.yesNo(item.globalAddressList),
    },
    {
      key: 'backupMx',
      label: lt('mailbox.backup_mx'),
      from: '2xl',
      value: (item) => format.yesNo(item.backupMx),
    },
    {
      key: 'relayAllRecipients',
      label: lt('mailbox.relay_all'),
      from: '2xl',
      value: (item) => format.yesNo(item.relayAllRecipients),
    },
    {
      key: 'relayUnknownOnly',
      label: lt('mailbox.relay_unknown'),
      from: '2xl',
      value: (item) => format.yesNo(item.relayUnknownOnly),
    },
    {
      key: 'active',
      label: lt('mailbox.active'),
      from: 'md',
      value: (item) => format.yesNo(item.active),
    },
  ]
}
