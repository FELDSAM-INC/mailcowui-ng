// New-string keys that the app builds at runtime (problem types, HTTP statuses, enumeration values)
// and that the classic interface already has a text for. They are shown with mailcow's own text,
// verbatim and in the user's language (constitution IV 1.3.0, docs/conventions.md "Messages"),
// instead of a new string. Static texts never come here: they use `lt()` or `<LegacyText>`.
// `npm run i18n:check` reads this table: a required key listed here needs no new string (and may
// not have one), and every target must be a text of the en-gb snapshot.
import type { LegacyKey } from './legacy'

export const LEGACY_TEXTS: Readonly<Partial<Record<string, LegacyKey>>> = {
  // Problems: the classic `danger.*`, `warning.*` and `info.*` message of the same meaning.
  'problem.csrf-token-mismatch': 'warning.session_token',
  'problem.forbidden': 'danger.access_denied',
  'problem.second-factor-required': 'info.awaiting_tfa_confirmation',
  'problem.sign-in-failed': 'danger.login_failed',
  'problem.temporary-verification-failure': 'danger.temp_error',
  'problem.status.403': 'danger.access_denied',
  'problem.status.500': 'danger.generic_server_error',
  'problem.generic': 'danger.unknown',
  // Column headers built from the column's name.
  'apiKeys.columns.owner': 'mailbox.owner',
  'apiKeys.columns.status': 'mailbox.status',
  // Enumeration values with a classic name.
  'roles.admin': 'admin.admin',
  'roles.domainAdmin': 'admin.domain_admin',
  'enums.announcementType.danger': 'admin.ui_header_announcement_type_danger',
  'enums.announcementType.info': 'admin.ui_header_announcement_type_info',
  'enums.announcementType.warning': 'admin.ui_header_announcement_type_warning',
  'enums.apiKeyAccessLevel.readOnly': 'admin.api_read_only',
  'enums.apiKeyAccessLevel.readWrite': 'admin.api_read_write',
  'enums.apiKeyStatus.active': 'admin.active',
  'enums.auditOutcome.success': 'debug.success',
  'enums.auditTargetType.apiKey': 'admin.api_key',
  'enums.authMethod.apiKey': 'admin.api_key',
  'enums.authMethod.password': 'login.password',
  // UI 002: the audit targets of a domain and its footer.
  'enums.auditTargetType.domain': 'mailbox.domain',
  'enums.auditTargetType.domainFooter': 'edit.domain_footer',
  // UI 002: field labels looked up by field name (problems, outdated notices, error parameters).
  'domains.fields.domain': 'mailbox.domain',
  'domains.fields.description': 'mailbox.description',
  'domains.fields.template': 'mailbox.template',
  'domains.fields.active': 'edit.active',
  'domains.fields.maxMailboxes': 'edit.max_mailboxes',
  'domains.fields.maxAliases': 'edit.max_aliases',
  'domains.fields.domainQuota': 'edit.domain_quota',
  'domains.fields.globalAddressList': 'edit.gal',
  'domains.fields.tags': 'add.tags',
  'domains.fields.rateLimit': 'edit.ratelimit',
  'domains.fields.dkimSelector': 'admin.dkim_domains_selector',
  'domains.fields.dkimKeySize': 'admin.dkim_key_length',
  // UI 002: the rate limit frames, by the frame's value.
  'domains.rateLimit.frame.second': 'ratelimit.second',
  'domains.rateLimit.frame.minute': 'ratelimit.minute',
  'domains.rateLimit.frame.hour': 'ratelimit.hour',
  'domains.rateLimit.frame.day': 'ratelimit.day',
  // UI 004 (legacy form map): the audit targets, the enumeration values its screens render, and
  // the legacy messages of its problem types and form fields (research R17). Placeholders are
  // filled through LEGACY_ARGS below.
  'enums.auditTargetType.alias': 'mailbox.alias',
  'enums.auditTargetType.aliasDomain': 'add.alias_domain',
  'enums.auditTargetType.resource': 'edit.resource',
  'enums.auditTargetType.mailboxSenderSettings': 'edit.sender_acl',
  'enums.aliasKind.catchAll': 'mailbox.catch_all',
  'enums.aliasDestinationType.addresses': 'add.target_address',
  'enums.aliasDestinationType.discard': 'add.goto_null',
  'enums.aliasDestinationType.learnSpam': 'mailbox.goto_spam',
  'enums.aliasDestinationType.learnHam': 'mailbox.goto_ham',
  'enums.resourceBookingRule.alwaysFree': 'mailbox.booking_null',
  'enums.resourceBookingRule.unlimited': 'mailbox.booking_ltnull',
  'enums.resourceBookingRule.limited': 'mailbox.booking_custom',
  'problem.address-in-use': 'danger.is_alias_or_mailbox',
  'problem.address-in-use.holder.alias': 'danger.is_alias',
  'problem.address-in-use.holder.temporaryAlias': 'danger.is_spam_alias',
  'problem.address-in-use.holder.mailbox': 'danger.is_alias_or_mailbox',
  'problem.address-in-use.holder.resource': 'danger.is_alias_or_mailbox',
  'problem.domain-alias-limit-reached': 'danger.max_alias_exceeded',
  'problem.alias-domain-already-exists': 'danger.alias_domain_invalid',
  'problem.alias-domain-already-exists.existingKind.domain': 'danger.alias_domain_invalid',
  'problem.alias-domain-already-exists.existingKind.aliasDomain': 'danger.alias_domain_invalid',
  'problem.not-primary-domain-alias': 'warning.is_not_primary_alias',
  'problem.permission-flag-required': 'danger.access_denied',
  'aliases.form.errors.address.required': 'danger.alias_empty',
  'aliases.form.errors.address.invalidFormat': 'danger.alias_invalid',
  'aliases.form.errors.address.notFound': 'danger.domain_not_found',
  'aliases.form.errors.destinations.required': 'danger.goto_empty',
  'aliases.form.errors.destinations.invalidFormat': 'danger.goto_invalid',
  'aliases.form.errors.destinations.notEligible.kind.resource': 'danger.goto_invalid',
  'aliases.form.errors.destinations.notEligible.kind.externalDestination':
    'danger.external_goto_denied',
  'aliases.form.errors.destinations.conflictsWith.field.address': 'danger.alias_goto_identical',
  'aliases.form.errors.destinations.attributeNotPermitted': 'danger.external_goto_denied',
  'aliases.form.errors.publicComment.tooLong': 'danger.comment_too_long',
  'aliases.form.errors.privateComment.tooLong': 'danger.comment_too_long',
  'aliasDomains.form.errors.name.invalidFormat': 'danger.alias_domain_invalid',
  'aliasDomains.form.errors.name.reserved': 'danger.domain_cannot_match_hostname',
  'aliasDomains.form.errors.name.conflictsWith.field.targetDomain':
    'danger.aliasd_targetd_identical',
  'aliasDomains.form.errors.targetDomain.notFound': 'danger.targetd_not_found',
  'aliasDomains.form.errors.targetDomain.notEligible.kind.relayDomain':
    'danger.targetd_relay_domain',
  'aliasDomains.form.errors.targetDomain.notEligible.kind.aliasDomain':
    'danger.target_domain_invalid',
  'aliasDomains.form.errors.rateLimit.frame.notInList': 'danger.rl_timeframe',
  'resources.form.errors.description.invalidFormat': 'danger.description_invalid',
  'resources.form.errors.domain.notFound': 'danger.domain_not_found',
  'resources.form.errors.domain.notEligible.kind.aliasDomain': 'danger.domain_invalid',
  'senderSettings.errors.explicitPermissions.invalidFormat': 'danger.sender_acl_invalid',
  'senderSettings.errors.explicitPermissions.notFound': 'danger.sender_acl_invalid',
  'senderSettings.errors.explicitPermissions.notEligible': 'danger.sender_acl_invalid',
  'senderSettings.errors.externalSenderAddresses.invalidFormat': 'danger.extra_acl_invalid',
  'senderSettings.errors.externalSenderAddresses.notEligible.kind.localDomain':
    'danger.extra_acl_invalid_domain',
  'senderSettings.errors.externalSenderAddresses.attributeNotPermitted':
    'danger.extended_sender_acl_denied',
}

/**
 * UI 004: the parameters that fill a legacy message's `%s` and `%d`, in order, for the keys above
 * whose legacy value has placeholders. They are the problem's extension members (`address`,
 * `name`), the caller's context parameters, and for field errors `entry` (the value sent at the
 * field or entry) and `entryDomain` (its domain part), as `inc/functions.mailbox.inc.php` fills
 * them.
 */
export const LEGACY_ARGS: Readonly<Partial<Record<string, readonly string[]>>> = {
  'problem.address-in-use': ['address'],
  'problem.address-in-use.holder.alias': ['address'],
  'problem.address-in-use.holder.temporaryAlias': ['address'],
  'problem.address-in-use.holder.mailbox': ['address'],
  'problem.address-in-use.holder.resource': ['address'],
  'problem.alias-domain-already-exists': ['name'],
  'problem.alias-domain-already-exists.existingKind.domain': ['name'],
  'problem.alias-domain-already-exists.existingKind.aliasDomain': ['name'],
  'problem.not-primary-domain-alias': ['address'],
  'aliases.form.errors.address.invalidFormat': ['entry'],
  'aliases.form.errors.address.notFound': ['entryDomain'],
  'aliases.form.errors.destinations.invalidFormat': ['entry'],
  'aliases.form.errors.destinations.notEligible.kind.resource': ['entry'],
  'aliases.form.errors.destinations.notEligible.kind.externalDestination': ['entry'],
  'aliases.form.errors.destinations.attributeNotPermitted': ['entry'],
  'aliasDomains.form.errors.name.invalidFormat': ['entry'],
  'aliasDomains.form.errors.name.conflictsWith.field.targetDomain': ['targetDomain'],
  'aliasDomains.form.errors.targetDomain.notFound': ['entry'],
  'aliasDomains.form.errors.targetDomain.notEligible.kind.relayDomain': ['entry'],
  'aliasDomains.form.errors.targetDomain.notEligible.kind.aliasDomain': ['entry'],
  'resources.form.errors.description.invalidFormat': ['entry'],
  'resources.form.errors.domain.notFound': ['entry'],
  'senderSettings.errors.explicitPermissions.invalidFormat': ['entry'],
  'senderSettings.errors.explicitPermissions.notFound': ['entry'],
  'senderSettings.errors.explicitPermissions.notEligible': ['entry'],
  'senderSettings.errors.externalSenderAddresses.invalidFormat': ['entry'],
  'senderSettings.errors.externalSenderAddresses.notEligible.kind.localDomain': ['entryDomain'],
}
