// Translation keys of the domain and template fields, for error messages that name a field
// (`mustNotExceed`, `attribute-not-permitted`).
export const FIELD_LABEL_KEYS: Record<string, string> = {
  name: 'domains.fields.domain',
  description: 'domains.fields.description',
  templateId: 'domains.fields.template',
  active: 'domains.fields.active',
  maxMailboxes: 'domains.fields.maxMailboxes',
  maxAliases: 'domains.fields.maxAliases',
  maxMailboxQuota: 'domains.fields.maxMailboxQuota',
  domainQuota: 'domains.fields.domainQuota',
  backupMx: 'domains.relay.short.backupMx',
  relayAllRecipients: 'domains.relay.short.relayAllRecipients',
  relayUnknownOnly: 'domains.relay.short.relayUnknownOnly',
  globalAddressList: 'domains.fields.globalAddressList',
  tags: 'domains.fields.tags',
  rateLimit: 'domains.fields.rateLimit',
  dkimSelector: 'domains.fields.dkimSelector',
  dkimKeySize: 'domains.fields.dkimKeySize',
}

export const SIZE_FIELDS = new Set(['maxMailboxQuota', 'domainQuota'])
