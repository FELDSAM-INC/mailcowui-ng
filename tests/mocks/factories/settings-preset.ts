// Fixture content copied from mailcow's published presets; the API resolves headlines.
import type { Preset } from '@/api'
export const settingsPresets: Preset[] = [
  {
    id: 'preset_1',
    kind: 'rspamd',
    translationKey: 'admin.rsettings_preset_1',
    headline: 'Disable all but DKIM and rate limit for authenticated users',
    content:
      'priority = 10;\nauthenticated = yes;\napply "default" {\n  symbols_enabled = ["BCC", "DKIM_SIGNED", "RATELIMITED", "RATELIMIT_UPDATE", "RATELIMIT_CHECK", "DYN_RL_CHECK", "HISTORY_SAVE", "MILTER_HEADERS", "ARC_SIGNED"];\n}\n',
  },
  {
    id: 'preset_3',
    kind: 'rspamd',
    translationKey: 'admin.rsettings_preset_3',
    headline: 'Only allow specific senders for a mailbox (i.e. usage as internal mailbox only)',
    content:
      'priority = 10;\nrcpt = "internal-only@domain.tld";\n# Multiple allowed hosts\n# from = "/^((?!(.*@allowed-domain\\.tld|.*@other-allowed-domain\\.tld)).)*$/";\nfrom = "/^((?!.*@domain\\.tld).)*$/";\napply "default" {\n  MAILCOW_BLACK = 9999.0;\n}\nsymbols [\n  "MAILCOW_BLACK"\n]\n',
  },
  {
    id: 'preset_4',
    kind: 'rspamd',
    translationKey: 'admin.rsettings_preset_4',
    headline: 'Disable Rspamd for a domain',
    content:
      'priority = 10;\nrcpt = "/.*@develcow.de$/";\nfrom = "/.*/";\napply "default" {\n  MAILCOW_WHITE = -9999.0;\n}\nsymbols [\n  "MAILCOW_WHITE"\n]\n',
  },
  {
    id: 'sieve_1',
    kind: 'sieve',
    translationKey: 'mailbox.sieve_preset_1',
    headline: 'Discard mail with probable dangerous file types',
    content:
      'require ["reject","body","regex"];\nif anyof (body :raw :regex ["filename=\\".*\\\\.(doc|exe|moo)\\""]) {\n  reject text:\ndoc, exe and moo are dangerous file extensions.\nWhy would you do that? I am a sad cow.\n.\n;\n}\n',
  },
  {
    id: 'sieve_2',
    kind: 'sieve',
    translationKey: 'mailbox.sieve_preset_2',
    headline: 'Always mark the e-mail of a specific sender as seen',
    content:
      'require ["envelope", "imap4flags"];\nif envelope "from" "mark@me-read.com"\n{\n   setflag "\\\\seen";\n}\n',
  },
  {
    id: 'sieve_3',
    kind: 'sieve',
    translationKey: 'mailbox.sieve_preset_3',
    headline: 'Discard silently, stop all further sieve processing',
    content: 'discard; stop;\n',
  },
  {
    id: 'sieve_4',
    kind: 'sieve',
    translationKey: 'mailbox.sieve_preset_4',
    headline: 'File into INBOX, skip further processing by sieve filters',
    content: 'require "fileinto";\nfileinto "INBOX"; stop;\n',
  },
  {
    id: 'sieve_5',
    kind: 'sieve',
    translationKey: 'mailbox.sieve_preset_5',
    headline: 'Auto responder (vacation)',
    content:
      'require "vacation-seconds";\nif true\n{\n  # Only send once a day:\n  # vacation :seconds 86400 text:\n  # Only send once every 300 seconds:\n  # vacation :seconds 300 text:\n  # Else:\n  vacation text:\nI am on holidays, yay!\nMail me later, alligator.\n.\n;\n}\n',
  },
  {
    id: 'sieve_6',
    kind: 'sieve',
    translationKey: 'mailbox.sieve_preset_6',
    headline: 'Reject mail with reponse',
    content:
      'require ["reject"];\n# Rejects are sent from postmaster@mailcow_hostname, make sure DMARC/SPF are fine\n# You should prefer rejects via mailcow blacklists\nreject text:\nI am not taking mail from you, and I don\'t\nwant your birdseed, either!\n.\n;\n',
  },
  {
    id: 'sieve_7',
    kind: 'sieve',
    translationKey: 'mailbox.sieve_preset_7',
    headline: 'Redirect and keep/drop',
    content:
      'redirect "other-address@domain.tld";\n# Either keep after redirecting:\n# keep;\n# Or redirect and drop:\ndiscard; stop;\n',
  },
  {
    id: 'sieve_8',
    kind: 'sieve',
    translationKey: 'mailbox.sieve_preset_8',
    headline: 'Redirect e-mail from a specific sender, mark as read and sort into subfolder',
    content:
      'require "fileinto";\nrequire "mailbox";\nrequire "variables";\nrequire "subaddress";\nrequire "envelope";\nrequire "duplicate";\nrequire "imap4flags";\nif header :matches "To" "*mail@domain.tld*" {\n  redirect "anothermail@anotherdomain.tld";\n  setflag "\\\\seen"; /* Mark mail as read */\n  fileInto "INBOX/SubFolder"; /* Move mail on subfolder after */\n} else {\n  # The rest goes into INBOX\n  # default is "implicit keep", we do it explicitly here\n  keep;\n}\n',
  },
  {
    id: 'zz_unknown',
    kind: 'rspamd',
    translationKey: 'admin.rsettings_preset_999',
    headline: 'Operator example',
    content: 'apply { symbols = ["EXAMPLE"]; }',
  },
  {
    id: 'zzz_null',
    kind: 'rspamd',
    translationKey: null,
    headline: 'Custom local example',
    content: 'priority = 10;',
  },
]
