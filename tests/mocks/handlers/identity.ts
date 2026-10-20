// Identity and preferences handlers (T026, T116). `scope` and `permissions` come from the
// signed-in account. A stored language that the server no longer enables reads as the default
// language. Preferences are a JSON Merge Patch with `If-Match` (412 when outdated), languages are
// checked against the enabled ones (`422 notInList` with `allowed`), and a restricted session is
// refused like every other operation.
import type { IdentityProviderType, Preferences, PreferencesPatch, Writable } from '@/api'

import type { MockAccount, MockAuthMethod, ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, requireAccount, scenario } from './context'

let version = 1

/** The preferences as the API reports them: a language no longer enabled reads as the default. */
function effectivePreferences(state: ScenarioState, account: MockAccount): Preferences {
  const enabled = state.publicConfig.languages.map((language) => language.code)
  const { language } = account.preferences
  return enabled.includes(language)
    ? account.preferences
    : { ...account.preferences, language: state.publicConfig.defaultLanguage }
}

/** UI 012: sign-ins through the identity provider name the provider type. */
function authenticationOf(state: ScenarioState): {
  method: MockAuthMethod
  identityProvider?: IdentityProviderType
} {
  const method = state.session.authMethod ?? 'password'
  if (method === 'singleSignOn') return { method, identityProvider: state.singleSignOn.provider }
  if (method.startsWith('directoryPassword')) return { method, identityProvider: 'ldap' }
  if (method.startsWith('providerPassword')) return { method, identityProvider: 'keycloak' }
  return { method }
}

export const identityHandlers = [
  http.get('/me', ({ response }) => {
    const state = scenario()
    const account = requireAccount(state, { allowRestricted: true })
    if (account instanceof Response) return response.untyped(account)
    return response(200).json({
      data: {
        username: account.username,
        role: account.role,
        authentication: authenticationOf(state),
        scope: account.scope,
        permissions: account.permissions,
        pendingActions: account.pendingActions,
        preferences: effectivePreferences(state, account),
        ...(account.impersonation ? { impersonation: account.impersonation } : {}),
      },
    })
  }),

  http.patch('/me/preferences', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    const ifMatch = request.headers.get('if-match')
    if (ifMatch && ifMatch !== '*' && ifMatch !== account.preferences.etag) {
      return response.untyped(problem(412, null))
    }
    const body = (await request.json()) as unknown as Writable<PreferencesPatch>
    const allowed = state.publicConfig.languages.map((language) => language.code)
    if (body.language !== undefined && !allowed.includes(body.language)) {
      return response.untyped(
        problem(422, 'validation-failed', {
          errors: {
            language: [
              { code: 'notInList', message: 'Not an enabled language.', params: { allowed } },
            ],
          },
        }),
      )
    }
    account.preferences = {
      language: body.language ?? effectivePreferences(state, account).language,
      theme: body.theme ?? account.preferences.theme,
      etag: `"pref-v${++version}"`,
    }
    return response(200).json(
      { data: account.preferences },
      { headers: { ETag: account.preferences.etag } },
    )
  }),
]
