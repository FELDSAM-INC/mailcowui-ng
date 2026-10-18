// Public configuration variants of the mock (FR-001 to FR-009, FR-048, FR-060). Brand-like values
// are test data only; the app itself contains none (constitution IV).
import type { PublicConfig } from '@/api'

export const PUBLIC_CONFIG_VARIANTS = [
  'default',
  'custom-branding',
  'default-logo',
  'force-sso',
  'hidden-login-links',
  'identity-provider',
  'no-app-links',
  'malicious-html',
  'languages-czech-only',
  'languages-en-cs',
  'languages-untranslated',
] as const

export type PublicConfigVariant = (typeof PUBLIC_CONFIG_VARIANTS)[number]

/** Version query of the mock logos (`Logo.url`). */
export const LOGO_VERSION = '5f3c1a9e0b7d4c21'

const ALL_LANGUAGES = [
  { code: 'cs-cz', name: 'Čeština (Czech)' },
  { code: 'de-de', name: 'Deutsch (German)' },
  { code: 'en-gb', name: 'English' },
  { code: 'sk-sk', name: 'Slovenčina (Slovak)' },
]

function defaults(): PublicConfig {
  return {
    pageTitle: 'Example Mail',
    productName: 'Example Mail',
    logos: {
      light: { url: `/api/v2/public-config/logos/light?v=${LOGO_VERSION}`, isDefault: false },
      dark: { url: `/api/v2/public-config/logos/dark?v=${LOGO_VERSION}`, isDefault: false },
    },
    loginHelpHtml:
      '<p>Need help? Write to <a href="mailto:help@example.org">help@example.org</a>.</p>',
    footerHtml: '<p>Operated by Example Hosting.</p>',
    announcement: { text: 'Maintenance on Sunday 02:00–04:00 UTC.', type: 'warning', active: true },
    loginPage: {
      hideAdminLogin: false,
      hideDomainAdminLogin: false,
      hideMailboxUserLogin: false,
      forceSingleSignOn: false,
    },
    languages: ALL_LANGUAGES,
    defaultLanguage: 'en-gb',
    externalIdentityProvider: { configured: false },
    appsLabel: null,
    appLinks: [
      {
        name: 'Webmail',
        url: '/SOGo/so',
        signedInUrl: '/SOGo/so',
        description: 'Open the webmail',
        showOnLoginPage: true,
        source: 'builtIn',
      },
      {
        name: 'Helpdesk',
        url: 'https://helpdesk.example.org/',
        signedInUrl: 'https://helpdesk.example.org/?user=%u',
        description: null,
        showOnLoginPage: true,
        source: 'operator',
      },
    ],
  }
}

export function publicConfig(variant: PublicConfigVariant = 'default'): PublicConfig {
  const config = defaults()
  switch (variant) {
    case 'default':
      return config
    case 'custom-branding':
      return {
        ...config,
        pageTitle: 'Contoso Webmail Portal',
        productName: 'Contoso Mail',
        appsLabel: 'Our services',
        announcement: { text: 'New webmail is live.', type: 'info', active: true },
      }
    case 'default-logo':
      return {
        ...config,
        logos: {
          light: { url: '/img/cow_mailcow.svg', isDefault: true },
          dark: { url: '/img/cow_mailcow.svg', isDefault: true },
        },
      }
    case 'force-sso':
      return { ...config, loginPage: { ...config.loginPage, forceSingleSignOn: true } }
    case 'hidden-login-links':
      return {
        ...config,
        loginPage: { ...config.loginPage, hideAdminLogin: true, hideDomainAdminLogin: true },
      }
    case 'identity-provider':
      return { ...config, externalIdentityProvider: { configured: true } }
    case 'no-app-links':
      return { ...config, appLinks: [] }
    case 'malicious-html':
      return {
        ...config,
        productName: '<img src=x onerror=alert(1)>Example',
        announcement: { text: '<script>alert(1)</script>Read me', type: 'danger', active: true },
        loginHelpHtml:
          '<p onclick="alert(1)">Help <script>alert(1)</script><img src="//evil.example/x.png"><a href="javascript:alert(1)">bad</a> <a href="https://example.org/help">good</a></p><iframe src="https://evil.example"></iframe>',
        footerHtml:
          '<form action="https://evil.example"><input name="p"></form><style>body{display:none}</style><b>Footer</b>',
        appLinks: [
          ...config.appLinks,
          {
            name: 'Evil',
            url: 'javascript:alert(1)',
            signedInUrl: 'javascript:alert(1)',
            description: null,
            showOnLoginPage: true,
            source: 'operator',
          },
        ],
      }
    case 'languages-czech-only':
      return {
        ...config,
        languages: [{ code: 'cs-cz', name: 'Čeština (Czech)' }],
        defaultLanguage: 'cs-cz',
      }
    case 'languages-en-cs':
      return {
        ...config,
        languages: ALL_LANGUAGES.filter((language) => ['en-gb', 'cs-cz'].includes(language.code)),
      }
    case 'languages-untranslated':
      return {
        ...config,
        languages: [{ code: 'de-de', name: 'Deutsch (German)' }],
        defaultLanguage: 'de-de',
      }
  }
}
