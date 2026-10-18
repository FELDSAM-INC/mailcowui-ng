// Scenarios of US3 (T091): navigation by role and permission flags, the home screen scope, the
// apps menu, the announcement and the footer. Flags change at runtime through
// `PATCH /__mock/scenarios/:id` (`accounts`), and `forbidden` is injected for any operation
// through `failures`.
import type { AppLink, PublicConfig } from '@/api'

import type { ScenarioDefinition } from './index'
import { permissionFlags } from './accounts'
import { publicConfig } from './public-config'

const reseller = (flags: Parameters<typeof permissionFlags>[1] = {}) => ({
  permissions: permissionFlags(true, { syncjobs: true, bccMaps: false, loginAs: false, ...flags }),
})
const alice = (flags: Parameters<typeof permissionFlags>[1] = {}) => ({
  permissions: permissionFlags(false, flags),
})

const webmail: AppLink = {
  name: 'Webmail',
  url: '/SOGo/so',
  signedInUrl: '/SOGo/so',
  description: 'Open the webmail',
  showOnLoginPage: true,
  source: 'builtIn',
}
const helpdesk: AppLink = {
  name: 'Helpdesk',
  url: 'https://helpdesk.example.org/',
  signedInUrl: 'https://helpdesk.example.org/?user=%u',
  description: null,
  showOnLoginPage: true,
  source: 'operator',
}
const billing: AppLink = {
  name: 'Billing',
  url: 'https://billing.example.org/',
  signedInUrl: 'https://billing.example.org/login?u=%u',
  description: null,
  showOnLoginPage: false,
  source: 'operator',
}

const announcement = (type: 'info' | 'warning' | 'danger'): Partial<PublicConfig> => ({
  announcement: { text: `A ${type} announcement for everybody.`, type, active: true },
})

export const navigationScenarios: Record<string, ScenarioDefinition> = {
  'domain-admin-two-domains': {
    description: 'reseller (domain administrator of example.org and example.net) is signed in.',
    overrides: { signedInAs: 'reseller' },
  },
  'domain-admin-no-domains': {
    description: 'reseller is signed in and manages no domains.',
    overrides: {
      signedInAs: 'reseller',
      accounts: { reseller: { scope: { type: 'domains', domains: [] } } },
    },
  },
  'domain-admin-no-syncjobs': {
    description: 'reseller is signed in without the sync jobs and BCC maps flags.',
    overrides: { signedInAs: 'reseller', accounts: { reseller: reseller({ syncjobs: false }) } },
  },
  'domain-admin-bcc': {
    description: 'reseller is signed in with the sync jobs and BCC maps flags.',
    overrides: { signedInAs: 'reseller', accounts: { reseller: reseller({ bccMaps: true }) } },
  },
  'mailbox-no-spam-flags': {
    description: 'alice@example.org is signed in without spam score, spam policy or sync jobs.',
    overrides: { signedInAs: 'alice@example.org', accounts: { 'alice@example.org': alice() } },
  },
  'mailbox-spam-score': {
    description: 'alice@example.org is signed in with the spam score flag only.',
    overrides: {
      signedInAs: 'alice@example.org',
      accounts: { 'alice@example.org': alice({ spamScore: true }) },
    },
  },
  'mailbox-spam-policy': {
    description: 'alice@example.org is signed in with the spam policy flag only.',
    overrides: {
      signedInAs: 'alice@example.org',
      accounts: { 'alice@example.org': alice({ spamPolicy: true }) },
    },
  },
  'mailbox-syncjobs': {
    description: 'alice@example.org is signed in with the sync jobs flag only.',
    overrides: {
      signedInAs: 'alice@example.org',
      accounts: { 'alice@example.org': alice({ syncjobs: true }) },
    },
  },
  'flags-change': {
    description:
      'reseller is signed in without sync jobs; tests grant flags through PATCH (accounts.reseller.permissions).',
    overrides: { signedInAs: 'reseller', accounts: { reseller: reseller({ syncjobs: false }) } },
  },
  'app-links-webmail-and-two': {
    description:
      'alice@example.org is signed in; webmail and two operator links under "Our services".',
    overrides: {
      signedInAs: 'alice@example.org',
      publicConfig: { appsLabel: 'Our services', appLinks: [webmail, helpdesk, billing] },
    },
  },
  'app-links-groupware-disabled': {
    description: 'admin is signed in; the groupware is disabled, so webmail is not listed.',
    overrides: { signedInAs: 'admin', publicConfig: { appLinks: [helpdesk, billing] } },
  },
  'app-links-none': {
    description: 'admin is signed in; no app links are configured.',
    overrides: { signedInAs: 'admin', publicConfig: { appLinks: [] } },
  },
  'app-links-javascript-url': {
    description: 'admin is signed in; one operator link has a javascript: address.',
    overrides: {
      signedInAs: 'admin',
      publicConfig: {
        appLinks: [
          helpdesk,
          {
            ...billing,
            name: 'Evil',
            url: 'javascript:alert(1)',
            signedInUrl: 'javascript:alert(1)',
          },
        ],
      },
    },
  },
  'announcement-info': {
    description: 'admin is signed in; an information announcement is active.',
    overrides: { signedInAs: 'admin', publicConfig: announcement('info') },
  },
  'announcement-warning': {
    description: 'admin is signed in; a warning announcement is active.',
    overrides: { signedInAs: 'admin', publicConfig: announcement('warning') },
  },
  'announcement-danger': {
    description: 'admin is signed in; a danger announcement is active.',
    overrides: { signedInAs: 'admin', publicConfig: announcement('danger') },
  },
  'footer-malicious': {
    description: 'admin is signed in; the operator footer carries hostile HTML.',
    overrides: {
      signedInAs: 'admin',
      publicConfig: { footerHtml: publicConfig('malicious-html').footerHtml },
    },
  },
}
