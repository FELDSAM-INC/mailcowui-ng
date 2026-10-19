// Translation keys built from enumeration values (UI 005, legacy form map "Enumerations and
// flags"). `src/i18n/coverage.json` ("complete") requires every value; `text()` shows mailcow's own
// text where `LEGACY_TEXTS` names one (the second-factor types, tagged-mail handling) and the new
// string otherwise.
import type {
  AppPasswordProtocol,
  MailboxTaggedMailHandling,
  OwnSecondFactorType,
  SieveFilterKind,
} from '@/api'

export const secondFactorTypeKey = (type: OwnSecondFactorType) => `account.twoFactor.type.${type}`

/** The labels of legacy's app password form; the list shows DAV as `protocolShort`. */
export const appPasswordProtocolKey = (protocol: AppPasswordProtocol) =>
  `account.appPasswords.protocol.${protocol}`

export const appPasswordProtocolListKey = (protocol: AppPasswordProtocol) =>
  protocol === 'dav'
    ? 'account.appPasswords.protocolShort.dav'
    : `account.appPasswords.protocol.${protocol}`

/** Legacy's order of the app password protocols (form and list). */
export const APP_PASSWORD_PROTOCOL_ORDER: readonly AppPasswordProtocol[] = [
  'imap',
  'smtp',
  'activeSync',
  'dav',
  'pop3',
  'sieve',
]

export const taggedMailKey = (value: MailboxTaggedMailHandling) =>
  `account.mailSettings.tagged.${value}`

/** Legacy's order of the tagged-mail choices. */
export const TAGGED_MAIL_ORDER: readonly MailboxTaggedMailHandling[] = [
  'subfolder',
  'subject',
  'none',
]

export const filterKindKey = (kind: SieveFilterKind) => `filters.kind.${kind}`
