// The neutral built-in defaults when the public configuration cannot be loaded (FR-003): the
// server's host name as the product name, no logo, texts or links, mailcow's default language menu
// (applied by the start sequence) and no login page options. No product or operator name exists
// in the source (constitution IV).
import type { Branding } from './public-config'

export function defaultBranding(hostname: string = window.location.hostname): Branding {
  return {
    productName: hostname,
    pageTitle: hostname,
    logos: { light: null, dark: null },
    loginHelpHtml: null,
    footerHtml: null,
    announcement: null,
    loginPage: {
      hideAdminLogin: false,
      hideDomainAdminLogin: false,
      hideMailboxUserLogin: false,
      forceSingleSignOn: false,
    },
    languages: null,
    defaultLanguage: null,
    externalIdentityProvider: false,
    appsLabel: null,
    appLinks: [],
    fromServer: false,
  }
}
