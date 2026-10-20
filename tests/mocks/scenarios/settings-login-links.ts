import type { AppLinkSettings, LoginPageSettings } from '@/api'
import type { ScenarioDefinition } from './index'
import type { ScenarioState } from './state'
interface LoginLinksState {
  login: LoginPageSettings
  apps: AppLinkSettings
  revision: number
}
const stores = new WeakMap<ScenarioState, LoginLinksState>()
export function loginLinksState(state: ScenarioState): LoginLinksState {
  const existing = stores.get(state)
  if (existing) return existing
  const store: LoginLinksState = {
    login: { ...state.publicConfig.loginPage, etag: '"login-page-1"' },
    apps: {
      builtInLinks: state.publicConfig.appLinks.filter((link) => link.source === 'builtIn'),
      links: state.publicConfig.appLinks
        .filter((link) => link.source === 'operator')
        .map(({ name, url, signedInUrl, showOnLoginPage }) => ({
          name,
          url,
          signedInUrl: signedInUrl === url ? null : signedInUrl,
          showOnLoginPage,
        })),
      etag: '"app-links-1"',
    },
    revision: 1,
  }
  stores.set(state, store)
  return store
}
export function publishLoginLinks(state: ScenarioState) {
  const { login, apps } = loginLinksState(state)
  state.publicConfig.loginPage = {
    hideAdminLogin: login.hideAdminLogin,
    hideDomainAdminLogin: login.hideDomainAdminLogin,
    hideMailboxUserLogin: login.hideMailboxUserLogin,
    forceSingleSignOn: login.forceSingleSignOn,
  }
  state.publicConfig.appLinks = [
    ...apps.builtInLinks,
    ...apps.links.map((link) => ({
      ...link,
      signedInUrl: link.signedInUrl || link.url,
      source: 'operator' as const,
      description: null,
    })),
  ]
}
function links(count: number): ScenarioDefinition {
  return {
    description: `${count} ordered custom app links.`,
    overrides: { signedInAs: 'admin' },
    setup(state) {
      loginLinksState(state).apps.links = Array.from({ length: count }, (_, i) => ({
        name: `App ${i + 1}`,
        url: `/app-${i + 1}`,
        signedInUrl: null,
        showOnLoginPage: true,
      }))
      publishLoginLinks(state)
    },
  }
}
export const settingsLoginLinksScenarios: Record<string, ScenarioDefinition> = {
  'app-links-three': links(3),
  'app-links-50': links(50),
  'idp-sso-available': {
    description: 'An external single sign-on provider is available.',
    overrides: {
      signedInAs: 'admin',
      publicConfig: { externalIdentityProvider: { configured: true, singleSignOnAvailable: true } },
    },
  },
}
