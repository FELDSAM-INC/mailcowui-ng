// The labels of the domain value forms, as the classic forms name them (owner rule 1:1):
// - `domainAdd`: "Add domain", `templates/modals/mailbox.twig` #addDomainModal;
// - `templateAdd`: "Add Template", `templates/modals/mailbox.twig` #addDomainTemplateModal;
// - `templateEdit`: `templates/edit/domain-templates.twig`.
// They also name fields in error messages (`mustNotExceed`, field errors of the API). The keys are
// mailcow's own (`lt()`); the help texts with markup are shown with `<LegacyText>`.
import { lt, type LegacyKey } from '@/i18n'

import type { RelayLabels } from './components/fields/RelayOptionsField.vue'

export type ValueForm = 'domainAdd' | 'templateAdd' | 'templateEdit'

const ADD: Record<string, LegacyKey> = {
  tags: 'add.tags',
  maxAliases: 'add.max_aliases',
  maxMailboxes: 'add.max_mailboxes',
  maxMailboxQuota: 'add.mailbox_quota_m',
  domainQuota: 'add.domain_quota_m',
  active: 'add.active',
  dkimSelector: 'admin.dkim_domains_selector',
  dkimKeySize: 'admin.dkim_key_length',
}

const EDIT_RELAY: Record<string, LegacyKey> = {
  backupMx: 'edit.relay_domain',
  relayAllRecipients: 'edit.relay_all',
  relayUnknownOnly: 'edit.relay_unknown_only',
}

const LABELS: Record<ValueForm, Record<string, LegacyKey>> = {
  domainAdd: {
    ...ADD,
    name: 'add.domain',
    description: 'add.description',
    templateId: 'mailbox.template',
    globalAddressList: 'edit.gal',
    rateLimit: 'acl.ratelimit',
    backupMx: 'add.relay_domain',
    relayAllRecipients: 'add.relay_all',
    relayUnknownOnly: 'add.relay_unknown_only',
  },
  templateAdd: {
    ...ADD,
    ...EDIT_RELAY,
    name: 'mailbox.template',
    globalAddressList: 'add.gal',
    rateLimit: 'edit.ratelimit',
  },
  templateEdit: {
    ...ADD,
    ...EDIT_RELAY,
    name: 'mailbox.template',
    tags: 'add.tags',
    maxAliases: 'edit.max_aliases',
    maxMailboxes: 'edit.max_mailboxes',
    maxMailboxQuota: 'edit.max_quota',
    domainQuota: 'edit.domain_quota',
    globalAddressList: 'edit.gal',
    active: 'edit.active',
    rateLimit: 'edit.ratelimit',
  },
}

export function formLabelKeys(form: ValueForm): Record<string, LegacyKey> {
  return LABELS[form]
}

/** A field's label in a form, or the field's name if the form has none. */
export function formLabel(form: ValueForm, field: string): string {
  const key = LABELS[form][field]
  return key ? lt(key) : field
}

/** The Global Address List's help text (with markup). */
export function galInfoKey(form: ValueForm): LegacyKey {
  return form === 'templateAdd' ? 'add.gal_info' : 'edit.gal_info'
}

export function relayLabels(form: ValueForm): RelayLabels {
  return form === 'domainAdd'
    ? {
        legend: 'add.backup_mx_options',
        backupMx: 'add.relay_domain',
        relayAllRecipients: 'add.relay_all',
        relayAllInfo: 'add.relay_all_info',
        relayUnknownOnly: 'add.relay_unknown_only',
        transportInfo: 'add.relay_transport_info',
      }
    : {
        legend: 'edit.backup_mx_options',
        backupMx: 'edit.relay_domain',
        relayAllRecipients: 'edit.relay_all',
        relayAllInfo: 'edit.relay_all_info',
        relayUnknownOnly: 'edit.relay_unknown_only',
        transportInfo: 'edit.relay_transport_info',
      }
}

/** The element IDs of the fields, for focusing field errors. */
export function formFieldIds(prefix: string): Record<string, string> {
  return {
    name: `${prefix}-name`,
    description: `${prefix}-description`,
    templateId: `${prefix}-template`,
    tags: `${prefix}-tags`,
    maxAliases: `${prefix}-maxAliases`,
    maxMailboxes: `${prefix}-maxMailboxes`,
    maxMailboxQuota: `${prefix}-maxMailboxQuota`,
    domainQuota: `${prefix}-domainQuota`,
    globalAddressList: `${prefix}-gal`,
    active: `${prefix}-active`,
    rateLimit: `${prefix}-rateLimit-value`,
    'rateLimit.value': `${prefix}-rateLimit-value`,
    'rateLimit.frame': `${prefix}-rateLimit-frame`,
    dkimSelector: `${prefix}-dkimSelector`,
    dkimKeySize: `${prefix}-dkimKeySize`,
    backupMx: `${prefix}-relay-backupMx`,
    relayAllRecipients: `${prefix}-relay-relayAllRecipients`,
    relayUnknownOnly: `${prefix}-relay-relayUnknownOnly`,
  }
}
