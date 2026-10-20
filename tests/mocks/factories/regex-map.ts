import type { RspamdRegexMap } from '@/api'
const definitions = [
  ['Header-From: Denylist', 'global_mime_from_blacklist.map'],
  ['Header-From: Allowlist', 'global_mime_from_whitelist.map'],
  ['Envelope Sender Denylist', 'global_smtp_from_blacklist.map'],
  ['Envelope Sender Allowlist', 'global_smtp_from_whitelist.map'],
  ['Recipient Denylist', 'global_rcpt_blacklist.map'],
  ['Recipient Allowlist', 'global_rcpt_whitelist.map'],
  ['Fishy TLDS (only fired in combination with bad words)', 'fishy_tlds.map'],
  ['Bad Words (only fired in combination with fishy TLDs)', 'bad_words.map'],
  ['Bad Words DE (only fired in combination with fishy TLDs)', 'bad_words_de.map'],
  ['Bad Languages', 'bad_languages.map'],
  ['Bulk Mail Headers', 'bulk_header.map'],
  ['Bad (Junk) Mail Headers', 'bad_header.map'],
  ['Monitoring Hosts', 'monitoring_nolog.map'],
] as const
export const regexMaps = (): RspamdRegexMap[] =>
  definitions.map(([name, id], index) => ({
    id,
    name,
    available: index !== 12,
    content: index !== 12 ? '# Existing patterns\n/old.example/i\n' : '',
    etag: `"map-${index}-1"`,
  }))
