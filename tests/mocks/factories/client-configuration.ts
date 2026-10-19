// The client configuration of the mock (UI 005 T011, research R21).
import type { MailboxClientConfiguration } from '@/api'

export function clientConfiguration(options: {
  address: string
  displayName: string
  groupware: boolean
}): MailboxClientConfiguration {
  const host = 'mail.example.net'
  return {
    address: options.address,
    displayName: options.displayName,
    imap: { host, tlsPort: 993, starttlsPort: 143 },
    pop3: { host, tlsPort: 995, starttlsPort: 110 },
    smtp: { host, tlsPort: 465, starttlsPort: 587 },
    caldav: options.groupware
      ? { host, port: 443, principalPath: `/SOGo/dav/${options.address}/` }
      : null,
    carddav: options.groupware
      ? { host, port: 443, principalPath: `/SOGo/dav/${options.address}/` }
      : null,
    activeSync: options.groupware ? { url: `https://${host}/Microsoft-Server-ActiveSync` } : null,
    authentication: 'password',
    autodiscoverType: 'activesync',
    outlookUsesActiveSync: true,
    documentationUrl: 'https://docs.mailcow.email/client/client/',
  }
}
