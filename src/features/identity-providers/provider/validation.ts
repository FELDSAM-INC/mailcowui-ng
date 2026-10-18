// The client rules of the identity provider form (FR-018, data-model §6): the numeric limits come
// from the capabilities read, the syntax rules from the contract (src/shared/validation/limits.ts).
// Errors are keyed by the API's field paths (`attributeMapping.2.template`), so the server's errors
// land on the same fields; each message is a translation key with its parameters.
import type { IdentityProviderCapabilities } from '@/api'
import { isIpNetwork } from '@/shared/validation/ip-network'
import {
  KEYCLOAK_REALM_MAX_LENGTH,
  KEYCLOAK_VERSION_MAX_LENGTH,
  KEYCLOAK_VERSION_PATTERN,
  LDAP_ATTRIBUTE_MAX_LENGTH,
  LDAP_ATTRIBUTE_PATTERN,
  LDAP_HOST_MAX_LENGTH,
  LDAP_PORT_MAX,
  LDAP_PORT_MIN,
  MAPPING_TEMPLATE_MAX_LENGTH,
  PROVIDER_CLIENT_ID_MAX_LENGTH,
  SCOPES_PATTERN,
} from '@/shared/validation/limits'

import { SECRET_OF, splitHosts, type ProviderForm } from './form-model'
import type { SecretRequirement } from './secret-rule'

export interface RuleMessage {
  key: string
  params?: Record<string, unknown>
}

export type RuleErrors = Record<string, RuleMessage[]>

export interface ValidationContext {
  limits: IdentityProviderCapabilities['limits']
  secret: SecretRequirement
}

const LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/

/** A host name of letters, digits and inner hyphens, or an IPv4 or IPv6 address (format `hostName`). */
export function isLdapHost(value: string): boolean {
  if (value === '' || value.length > LDAP_HOST_MAX_LENGTH || value.includes('/')) return false
  if (/^[0-9.]+$/.test(value) || value.includes(':')) return isIpNetwork(value)
  return value.split('.').every((label) => LABEL.test(label))
}

function isHttpUrl(value: string): boolean {
  if (/\s/.test(value)) return false
  try {
    const parsed = new URL(value)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.host !== ''
  } catch {
    return false
  }
}

/** Balanced parentheses, starting with `(` and ending with `)` (format `ldapFilter`). */
function isLdapFilter(value: string): boolean {
  if (!value.startsWith('(') || !value.endsWith(')')) return false
  let depth = 0
  for (const char of value) {
    if (char === '(') depth += 1
    else if (char === ')' && --depth < 0) return false
  }
  return depth === 0
}

const isWhole = (value: string) => /^\d+$/.test(value.trim())

export function validateForm(form: ProviderForm, ctx: ValidationContext): RuleErrors {
  const errors: RuleErrors = {}
  const add = (path: string, key: string, params?: Record<string, unknown>) => {
    ;(errors[path] ??= []).push(params ? { key, params } : { key })
  }
  const { limits } = ctx

  const required = (path: string, value: string) => {
    if (value.trim() !== '') return true
    add(path, 'validation.required')
    return false
  }
  const maxLength = (path: string, value: string, max: number) => {
    if (value.trim().length <= max) return true
    add(path, 'validation.tooLong', { max })
    return false
  }
  const httpUrl = (path: string, value: string, mandatory = true) => {
    if (mandatory ? !required(path, value) : value.trim() === '') return
    if (!maxLength(path, value, limits.urlMaxLength)) return
    if (!isHttpUrl(value.trim())) add(path, 'validation.format.httpUrl')
  }
  const range = (path: string, value: string, min: number, max: number) => {
    if (!required(path, value)) return
    const number = Number(value.trim())
    if (!isWhole(value) || number < min || number > max) {
      add(path, 'validation.outOfRange', { min, max })
    }
  }
  const attributeName = (path: string, value: string) => {
    if (value.trim() === '' || !maxLength(path, value, LDAP_ATTRIBUTE_MAX_LENGTH)) return
    if (!LDAP_ATTRIBUTE_PATTERN.test(value.trim())) add(path, 'validation.format.ldapAttribute')
  }
  const returnUrls = () => {
    httpUrl('legacyReturnUrl', form.legacyReturnUrl)
    const filled = form.additionalReturnUrls
      .map((value, index) => ({ value: value.trim(), index }))
      .filter((entry) => entry.value !== '')
    if (filled.length > limits.additionalReturnUrlsMaxEntries) {
      add('additionalReturnUrls', 'validation.tooMany', {
        max: limits.additionalReturnUrlsMaxEntries,
      })
    }
    const seen = new Set<string>()
    for (const { value, index } of filled) {
      const path = `additionalReturnUrls.${index}`
      if (seen.has(value)) add(path, 'validation.duplicate')
      else httpUrl(path, value)
      seen.add(value)
    }
  }
  const clientId = () => {
    if (required('clientId', form.clientId)) {
      maxLength('clientId', form.clientId, PROVIDER_CLIENT_ID_MAX_LENGTH)
    }
  }

  switch (form.type) {
    case 'keycloak':
      httpUrl('serverUrl', form.serverUrl)
      if (
        required('realm', form.realm) &&
        maxLength('realm', form.realm, KEYCLOAK_REALM_MAX_LENGTH)
      ) {
        if (form.realm.includes('/')) add('realm', 'validation.format.keycloakRealm')
      }
      clientId()
      if (
        required('version', form.version) &&
        maxLength('version', form.version, KEYCLOAK_VERSION_MAX_LENGTH) &&
        !KEYCLOAK_VERSION_PATTERN.test(form.version.trim())
      ) {
        add('version', 'validation.format.keycloakVersion')
      }
      returnUrls()
      break
    case 'genericOidc':
      httpUrl('authorizationEndpoint', form.authorizationEndpoint)
      httpUrl('tokenEndpoint', form.tokenEndpoint)
      httpUrl('userInfoEndpoint', form.userInfoEndpoint)
      clientId()
      if (form.scopes.trim() !== '' && !SCOPES_PATTERN.test(form.scopes.trim())) {
        add('scopes', 'validation.format.scopeList')
      }
      returnUrls()
      break
    case 'ldap': {
      const hosts = splitHosts(form.hosts)
      if (hosts.length === 0) add('hosts', 'validation.required')
      else if (hosts.length > limits.ldapHostsMaxEntries) {
        add('hosts', 'validation.tooMany', { max: limits.ldapHostsMaxEntries })
      } else if (!hosts.every(isLdapHost)) add('hosts', 'validation.format.hostName')
      range('port', form.port, LDAP_PORT_MIN, LDAP_PORT_MAX)
      if (required('baseDn', form.baseDn)) {
        maxLength('baseDn', form.baseDn, limits.distinguishedNameMaxLength)
      }
      attributeName('usernameField', form.usernameField)
      if (
        form.filter.trim() !== '' &&
        maxLength('filter', form.filter, limits.filterMaxLength) &&
        !isLdapFilter(form.filter.trim())
      ) {
        add('filter', 'validation.format.ldapFilter')
      }
      if ((form.importUsers || form.periodicSync) && form.attributeField.trim() === '') {
        add('attributeField', 'validation.required')
      } else attributeName('attributeField', form.attributeField)
      if (required('bindDn', form.bindDn)) {
        maxLength('bindDn', form.bindDn, limits.distinguishedNameMaxLength)
      }
      break
    }
  }

  // The secret: required for the reasons of the secret rule, at most the API's length.
  const secretField = SECRET_OF[form.type]
  const secret = form[secretField]
  if (secret === '' && ctx.secret)
    add(secretField, `validation.byParam.secretRequired.reason.${ctx.secret}`)
  else if (secret.length > limits.secretMaxLength) {
    add(secretField, 'validation.tooLong', { max: limits.secretMaxLength })
  }

  if (form.type !== 'genericOidc') {
    range(
      'syncInterval',
      form.syncInterval,
      limits.syncIntervalMinMinutes,
      limits.syncIntervalMaxMinutes,
    )
  }

  // The mapping: filled rows need both values; attribute values are unique, letter case counting.
  const rows = form.attributeMapping
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.attributeValue.trim() !== '' || row.template !== '')
  if (rows.length > limits.attributeMappingMaxEntries) {
    add('attributeMapping', 'validation.tooMany', { max: limits.attributeMappingMaxEntries })
  }
  const values = new Set<string>()
  for (const { row, index } of rows) {
    const valuePath = `attributeMapping.${index}.attributeValue`
    const value = row.attributeValue.trim()
    if (required(valuePath, value) && maxLength(valuePath, value, limits.attributeValueMaxLength)) {
      if (values.has(value)) add(valuePath, 'validation.duplicate')
      values.add(value)
    }
    if (required(`attributeMapping.${index}.template`, row.template)) {
      maxLength(`attributeMapping.${index}.template`, row.template, MAPPING_TEMPLATE_MAX_LENGTH)
    }
  }
  return errors
}
