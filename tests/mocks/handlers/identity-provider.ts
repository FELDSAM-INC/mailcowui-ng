// Identity provider handlers (UI 012 T016, T066, research R24): the capabilities, the stored
// configuration (`404 identity-provider-not-configured` before the first save), the whole save
// (`201` creating, `200` replacing, `If-Match` and `If-None-Match: *`), the merge patch, the removal,
// and the connection test of candidate settings. They apply the API's main rules: write-only
// secrets with `secretRequired` (`noStoredSecret`, `typeChanged`, `addressChanged`), the in-use
// refusals with the counts per source, unknown templates (`notFound`), repeated attribute values
// (`duplicate`), the API 012 formats, `conflictsWith` and `immutable`, and the normalisations
// (trailing slashes, lower-cased attribute names, StartTLS off with SSL).
import { delay } from 'msw'

import type { IdentityProviderInput, IdentityProviderPatch, IdentityProviderType } from '@/api'

import {
  connectionTestResult,
  identityProviderCapabilities,
  identityProviderEtag,
  identityProviderView,
  type MockIdentityProvider,
  type StoredIdentityProvider,
} from '../factories/identity-provider'
import type { ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, scenario } from './context'
import { addViolation, requireAdmin, validationFailed, type Violations } from './domain-rules'

const SECRET: Record<IdentityProviderType, 'clientSecret' | 'bindPassword'> = {
  keycloak: 'clientSecret',
  genericOidc: 'clientSecret',
  ldap: 'bindPassword',
}
const ADDRESS: Record<IdentityProviderType, string> = {
  keycloak: 'serverUrl',
  genericOidc: 'tokenEndpoint',
  ldap: 'hosts',
}
const SOURCES: IdentityProviderType[] = ['keycloak', 'genericOidc', 'ldap']

const notConfigured = () => problem(404, 'identity-provider-not-configured')
const outdated = () => problem(412, null)

function inUse(state: MockIdentityProvider, except: IdentityProviderType | null): Response | null {
  const blocking = SOURCES.filter((source) => source !== except).reduce(
    (sum, source) => sum + state.mailboxCounts[source],
    0,
  )
  if (blocking === 0) return null
  return problem(409, 'identity-provider-in-use', {
    blockingMailboxes: blocking,
    mailboxCounts: { ...state.mailboxCounts },
  })
}

/** The stored secret of a type, or null. */
const storedSecret = (idp: MockIdentityProvider, type: IdentityProviderType) =>
  idp.stored?.type === type ? idp[SECRET[type]] : null

function sameAddress(idp: MockIdentityProvider, candidate: Record<string, unknown>): boolean {
  const stored = idp.stored as Record<string, unknown> | null
  if (!stored || stored.type !== candidate.type) return false
  const key = ADDRESS[candidate.type as IdentityProviderType]
  const strip = (value: unknown) =>
    typeof value === 'string' ? value.trim().replace(/\/+$/, '') : JSON.stringify(value)
  return strip(stored[key]) === strip(candidate[key])
}

function isHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string' || /\s/.test(value)) return false
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.host !== ''
  } catch {
    return false
  }
}

const LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/
const isHost = (value: string) =>
  /^[0-9.]+$/.test(value)
    ? /^(\d{1,3}\.){3}\d{1,3}$/.test(value)
    : value.includes(':') || value.split('.').every((label) => LABEL.test(label))

/** The rules of a whole configuration (save and test); `templates` false for a test. */
function checkSettings(
  errors: Violations,
  values: Record<string, unknown>,
  state: ScenarioState,
  options: { templates: boolean },
): void {
  const type = values.type as IdentityProviderType
  const urlKeys =
    type === 'keycloak'
      ? ['serverUrl', 'legacyReturnUrl']
      : type === 'genericOidc'
        ? ['authorizationEndpoint', 'tokenEndpoint', 'userInfoEndpoint', 'legacyReturnUrl']
        : []
  for (const key of urlKeys) {
    if (!isHttpUrl(values[key])) addViolation(errors, key, 'invalidFormat', { format: 'httpUrl' })
  }
  const extra = (values.additionalReturnUrls as string[] | undefined) ?? []
  extra.forEach((url, index) => {
    if (!isHttpUrl(url)) {
      addViolation(errors, `additionalReturnUrls.${index}`, 'invalidFormat', { format: 'httpUrl' })
    }
  })
  if (type === 'keycloak' && typeof values.realm === 'string' && values.realm.includes('/')) {
    addViolation(errors, 'realm', 'invalidFormat', { format: 'keycloakRealm' })
  }
  if (type === 'ldap') {
    ;((values.hosts as string[]) ?? []).forEach((host, index) => {
      if (!isHost(host)) {
        addViolation(errors, `hosts.${index}`, 'invalidFormat', { format: 'hostName' })
      }
    })
    if ((values.importUsers || values.periodicSync) && !values.attributeField) {
      addViolation(errors, 'attributeField', 'conflictsWith', {
        field: values.importUsers ? 'importUsers' : 'periodicSync',
        value: true,
      })
    }
  }
  const mapping = (values.attributeMapping as { attributeValue: string; template: string }[]) ?? []
  const seen = new Map<string, number>()
  mapping.forEach((entry, index) => {
    const first = seen.get(entry.attributeValue)
    if (first !== undefined) {
      addViolation(errors, `attributeMapping.${index}.attributeValue`, 'duplicate', {
        duplicateOf: `attributeMapping.${first}.attributeValue`,
      })
    } else seen.set(entry.attributeValue, index)
    if (options.templates && !state.mailboxTemplates.includes(entry.template)) {
      addViolation(errors, `attributeMapping.${index}.template`, 'notFound', {
        resource: 'mailboxTemplate',
      })
    }
  })
  const fallback = values.defaultTemplate
  if (
    options.templates &&
    typeof fallback === 'string' &&
    !state.mailboxTemplates.includes(fallback)
  ) {
    addViolation(errors, 'defaultTemplate', 'notFound', { resource: 'mailboxTemplate' })
  }
}

/** The secret rule of a save or test: required for a new type or a changed address. */
function checkSecret(
  errors: Violations,
  idp: MockIdentityProvider,
  values: Record<string, unknown>,
): void {
  const type = values.type as IdentityProviderType
  const field = SECRET[type]
  if (typeof values[field] === 'string') return
  if (idp.stored && idp.stored.type !== type) {
    addViolation(errors, field, 'secretRequired', { reason: 'typeChanged' })
  } else if (!storedSecret(idp, type)) {
    addViolation(errors, field, 'secretRequired', { reason: 'noStoredSecret' })
  } else if (!sameAddress(idp, values)) {
    addViolation(errors, field, 'secretRequired', {
      reason: 'addressChanged',
      field: ADDRESS[type],
    })
  }
}

/** The stored settings of a whole configuration, with the defaults and the API's normalisations. */
function normalise(input: IdentityProviderInput, state: ScenarioState): StoredIdentityProvider {
  const d = identityProviderCapabilities(state.identityProvider).defaults
  const common = {
    attributeMapping: (input.attributeMapping ?? []).map(({ attributeValue, template }) => ({
      attributeValue,
      template,
    })),
    defaultTemplate: input.defaultTemplate ?? null,
    createMailboxOnSignIn: input.createMailboxOnSignIn ?? d.createMailboxOnSignIn,
    ignoreTlsErrors: input.ignoreTlsErrors ?? d.ignoreTlsErrors,
  }
  switch (input.type) {
    case 'keycloak':
      return {
        type: 'keycloak',
        serverUrl: input.serverUrl.replace(/\/+$/, ''),
        realm: input.realm,
        clientId: input.clientId,
        version: input.version,
        legacyReturnUrl: input.legacyReturnUrl ?? null,
        additionalReturnUrls: [...new Set(input.additionalReturnUrls ?? [])],
        mailpasswordFlow: input.mailpasswordFlow ?? d.mailpasswordFlow,
        importUsers: input.importUsers ?? d.importUsers,
        periodicSync: input.periodicSync ?? d.periodicSync,
        syncInterval: input.syncInterval ?? d.syncInterval,
        ...common,
      }
    case 'genericOidc':
      return {
        type: 'genericOidc',
        authorizationEndpoint: input.authorizationEndpoint,
        tokenEndpoint: input.tokenEndpoint,
        userInfoEndpoint: input.userInfoEndpoint,
        clientId: input.clientId,
        scopes: input.scopes ?? d.scopes,
        legacyReturnUrl: input.legacyReturnUrl ?? null,
        additionalReturnUrls: [...new Set(input.additionalReturnUrls ?? [])],
        ...common,
      }
    case 'ldap': {
      const useSsl = input.useSsl ?? d.useSsl
      return {
        type: 'ldap',
        hosts: [...input.hosts],
        port: input.port ?? d.port,
        useSsl,
        useStartTls: useSsl ? false : (input.useStartTls ?? d.useStartTls),
        baseDn: input.baseDn,
        usernameField: (input.usernameField ?? d.usernameField).toLowerCase(),
        filter: input.filter ? input.filter : null,
        attributeField: input.attributeField ? input.attributeField.toLowerCase() : null,
        bindDn: input.bindDn,
        importUsers: input.importUsers ?? d.importUsers,
        periodicSync: input.periodicSync ?? d.periodicSync,
        syncInterval: input.syncInterval ?? d.syncInterval,
        ...common,
      }
    }
  }
}

function testedAddress(values: Record<string, unknown>): string {
  switch (values.type as IdentityProviderType) {
    case 'keycloak': {
      const base = String(values.serverUrl).replace(/\/+$/, '')
      return `${base}/realms/${String(values.realm)}/protocol/openid-connect/token`
    }
    case 'genericOidc':
      return String(values.tokenEndpoint)
    case 'ldap': {
      const ssl = values.useSsl === true
      const port = Number(values.port ?? 389)
      const effective = ssl && port === 389 ? 636 : port
      return ((values.hosts as string[]) ?? [])
        .map((host) => `${ssl ? 'ldaps' : 'ldap'}://${host}:${effective}`)
        .join(' ')
    }
  }
}

/** Keeps the public configuration in step with the stored configuration (FR-012, FR-039). */
function syncPublicConfig(state: ScenarioState): void {
  const idp = state.identityProvider
  const view = idp.stored ? identityProviderView(idp, state.mailboxTemplates) : null
  state.publicConfig = {
    ...state.publicConfig,
    externalIdentityProvider: {
      configured: view !== null,
      singleSignOnAvailable: !!view && view.complete && view.type !== 'ldap',
    },
  }
}

function stamp(state: ScenarioState): void {
  state.identityProvider.version += 1
  state.identityProvider.modifiedAt = new Date(state.now()).toISOString()
}

/** A write's precondition: `rotateEtagOnNextWrite` stands for another administrator's save. */
function preconditionFailed(state: ScenarioState, ifMatch: string | null): boolean {
  const idp = state.identityProvider
  if (idp.rotateEtagOnNextWrite && idp.stored) {
    idp.rotateEtagOnNextWrite = false
    stamp(state)
    return true
  }
  if (ifMatch === null) return false
  if (ifMatch === '*') return !idp.stored
  return !idp.stored || ifMatch !== identityProviderEtag(idp)
}

/** `removedElsewhere`: the configuration was removed behind the app's back. */
function applyRemovedElsewhere(state: ScenarioState): void {
  const idp = state.identityProvider
  if (!idp.removedElsewhere) return
  idp.removedElsewhere = false
  idp.stored = null
  idp.clientSecret = null
  idp.bindPassword = null
  stamp(state)
  syncPublicConfig(state)
}

export const identityProviderHandlers = [
  http.get('/capabilities/identity-provider', ({ response }) => {
    const state = scenario()
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    return response(200).json({ data: identityProviderCapabilities(state.identityProvider) })
  }),

  http.get('/identity-provider', ({ response }) => {
    const state = scenario()
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const idp = state.identityProvider
    if (!idp.stored) return response.untyped(notConfigured())
    const data = identityProviderView(idp, state.mailboxTemplates)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.put('/identity-provider', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    applyRemovedElsewhere(state)
    const idp = state.identityProvider
    if (request.headers.get('if-none-match') === '*' && idp.stored) {
      return response.untyped(outdated())
    }
    if (preconditionFailed(state, request.headers.get('if-match'))) {
      return response.untyped(outdated())
    }
    const input = (await request.json())
    const values = input as unknown as Record<string, unknown>
    const errors: Violations = {}
    checkSettings(errors, values, state, { templates: true })
    checkSecret(errors, idp, values)
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    const blocked = idp.stored?.type !== input.type ? inUse(idp, input.type) : null
    if (blocked) return response.untyped(blocked)
    const creating = idp.stored === null
    const secret = SECRET[input.type]
    const sent = (values[secret] as string | undefined) ?? storedSecret(idp, input.type)
    idp.stored = normalise(input, state)
    idp.clientSecret = secret === 'clientSecret' ? sent : null
    idp.bindPassword = secret === 'bindPassword' ? sent : null
    stamp(state)
    syncPublicConfig(state)
    const data = identityProviderView(idp, state.mailboxTemplates)
    if (creating) {
      return response(201).json(
        { data },
        { headers: { ETag: data.etag, Location: '/api/v2/identity-provider' } },
      )
    }
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.patch('/identity-provider', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    applyRemovedElsewhere(state)
    const idp = state.identityProvider
    if (!idp.stored) return response.untyped(notConfigured())
    if (preconditionFailed(state, request.headers.get('if-match'))) {
      return response.untyped(outdated())
    }
    const patch = (await request.json()) as IdentityProviderPatch & Record<string, unknown>
    const errors: Violations = {}
    if (patch.type !== undefined && patch.type !== idp.stored.type) {
      addViolation(errors, 'type', 'immutable')
      return response.untyped(validationFailed(errors))
    }
    const stored = structuredClone(idp.stored) as unknown as Record<string, unknown>
    const merged = { ...stored, ...patch, type: idp.stored.type }
    const allowed = new Set([...Object.keys(stored), SECRET[idp.stored.type]])
    for (const key of Object.keys(patch)) {
      if (!allowed.has(key)) {
        addViolation(errors, key, 'conflictsWith', { field: 'type', value: idp.stored.type })
      }
    }
    checkSettings(errors, merged, state, { templates: true })
    checkSecret(errors, idp, merged)
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    const secret = SECRET[idp.stored.type]
    const sent = (patch[secret] as string | undefined) ?? idp[secret]
    idp.stored = normalise(merged as unknown as IdentityProviderInput, state)
    idp[secret] = sent
    stamp(state)
    syncPublicConfig(state)
    const data = identityProviderView(idp, state.mailboxTemplates)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.delete('/identity-provider', ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    applyRemovedElsewhere(state)
    const idp = state.identityProvider
    if (!idp.stored) return response.untyped(notConfigured())
    if (preconditionFailed(state, request.headers.get('if-match'))) {
      return response.untyped(outdated())
    }
    const blocked = inUse(idp, null)
    if (blocked) return response.untyped(blocked)
    idp.stored = null
    idp.clientSecret = null
    idp.bindPassword = null
    stamp(state)
    syncPublicConfig(state)
    return response(204).empty()
  }),

  http.post('/identity-provider/connection-tests', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const idp = state.identityProvider
    const values = (await request.json()) as unknown as Record<string, unknown>
    const errors: Violations = {}
    checkSettings(errors, values, state, { templates: false })
    checkSecret(errors, idp, values)
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    const test = idp.connectionTest
    if (test.hang) await delay('infinite')
    const outcome = test.sequence?.length ? test.sequence.shift()! : test.outcome
    const data = connectionTestResult(
      values.type as IdentityProviderType,
      testedAddress(values),
      outcome,
      new Date(state.now()).toISOString(),
      test.providerStatus ?? null,
    )
    return response(200).json({ data })
  }),
]
