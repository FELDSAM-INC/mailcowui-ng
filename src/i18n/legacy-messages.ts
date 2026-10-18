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
}
