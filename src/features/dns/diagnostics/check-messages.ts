// Diagnostics reasons, notes and guidance from their stable codes (research R15, data-model §2):
// the parameters formatted for the locale (numbers, lists, translated causes; host names,
// addresses and records verbatim), a `url` only as a separate link that `safeHref` accepts, and
// the values to copy (the SPF addresses and the suggested record). A code of a later release is
// shown with the API's English text, as the contract asks.
import { dnsCheckMessageCodeValues, type DnsCheckMessage } from '@/api'
import { hasMessage, text } from '@/i18n'
import { formatList, formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import { safeHref } from '@/shared/security/safe-url'

export interface MessageView {
  key: string
  params: Record<string, string>
  /** A "Learn more" address, accepted by safeHref. */
  link: string | null
  /** The API's English text of an unknown code. */
  englishFallback: string | null
  /** Values shown on their own, each copyable where it is a record or an address. */
  values: string[]
}

const NUMBERS = ['timeoutSeconds', 'count', 'limit', 'hours', 'port'] as const
const VERBATIM = ['host', 'target', 'address', 'record', 'result'] as const
/** Address families are written the same in every language. */
const FAMILIES: Record<string, string> = { ipv4: 'IPv4', ipv6: 'IPv6' }

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

export function messageView(message: DnsCheckMessage, locale: AppLocale): MessageView {
  const code = message.code
  if (!(dnsCheckMessageCodeValues as readonly string[]).includes(code)) {
    return {
      key: 'dns.diagnostics.messages.unknown',
      params: {},
      link: null,
      englishFallback: message.message,
      values: [],
    }
  }
  const raw = (message.params ?? {}) as Record<string, unknown>
  const params: Record<string, string> = {}
  for (const name of NUMBERS) {
    if (typeof raw[name] === 'number') params[name] = formatNumber(raw[name], locale)
  }
  for (const name of VERBATIM) {
    if (typeof raw[name] === 'string') params[name] = raw[name]
  }
  if (typeof raw.family === 'string') params.family = FAMILIES[raw.family] ?? raw.family
  if (typeof raw.cause === 'string') {
    const key = `dns.diagnostics.causes.${raw.cause}`
    params.cause = hasMessage(key) ? text(key) : raw.cause
  }
  let values: string[] = []
  if (code === 'matchedByAddressRecords') {
    const ipv4 = stringList(raw.ipv4)
    const ipv6 = stringList(raw.ipv6)
    if (ipv4.length > 0) params.ipv4 = formatList(ipv4, locale)
    if (ipv6.length > 0) params.ipv6 = formatList(ipv6, locale)
    values = [...ipv4, ...ipv6]
  } else if (code === 'spfAuthorizeAddresses') {
    if (typeof raw.ipv4 === 'string') values.push(`ip4:${raw.ipv4}`)
    if (typeof raw.ipv6 === 'string') values.push(`ip6:${raw.ipv6}`)
  } else if (code === 'spfSuggestedRecord' && typeof raw.record === 'string') {
    values = [raw.record]
  }
  const link = typeof raw.url === 'string' ? safeHref(raw.url) : null
  return { key: `dns.diagnostics.messages.${code}`, params, link, englishFallback: null, values }
}
