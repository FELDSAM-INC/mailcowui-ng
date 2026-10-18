// Shared rules of the UI 004 handlers (T016, research R21): the documented behaviour of API 004 on
// the scenario state. Normalisation and validity of addresses and domains, the holder lookup across
// mailboxes, resources, aliases and temporary aliases (including addresses that reach a mailbox
// through an alias domain), the external classification, the alias limit as API 002 counts it,
// domain administrator scope (with the alias domains of their domains), the representations with
// their derived members and version tags, the sender settings with implicit addresses, changeable
// and stale entries, and the cascades of deletions.
import type {
  Alias,
  AliasDomain,
  BulkItemResult,
  BulkResult,
  MailboxImplicitSenderAddress,
  MailboxSenderPermission,
  MailboxSenderSettings,
  Problem,
  Resource,
} from '@/api'

import {
  aliasEtag,
  mockAlias,
  domainPart,
  isValidAliasAddress,
  isValidDomainName,
  isValidEmail,
  normaliseAddress,
  readableAddress,
  splitAddress,
} from '../factories/alias'
import { aliasDomainEtag, aliasDomainValues } from '../factories/alias-domain'
import { asciiName, mailboxAddresses, readableName } from '../factories/domain'
import { addressOf } from '../factories/mailbox'
import { resourceEtag } from '../factories/resource'
import { rowsOf, senderSettingsEtag } from '../factories/sender-acl'
import type {
  MockAccount,
  MockAlias,
  MockAliasDomain,
  MockDomain,
  MockResource,
  ScenarioState,
} from '../scenarios/state'
import { problem } from './context'
import { addViolation, type Violations } from './domain-rules'

export const now = (state: ScenarioState) => new Date(state.now()).toISOString()

// ---------------------------------------------------------------------------------------------
// Domains, mailboxes and scope

export const findDomain = (state: ScenarioState, name: string): MockDomain | undefined =>
  state.domains.find((domain) => domain.name === name)

export const findAliasDomain = (state: ScenarioState, name: string): MockAliasDomain | undefined =>
  state.aliasDomains.find((item) => item.name === name)

/** A domain name in any spelling, as the API looks it up ('' when invalid). */
export const domainKey = (raw: string): string => asciiName(raw)

/**
 * The mailboxes of a domain: UI 002's domain addresses (`mailboxAddresses`, explicit or generated
 * from the usage) and UI 003's stored mailboxes. This is the one place that reads them.
 */
export function mailboxesOf(state: ScenarioState, domainName: string): string[] {
  const domain = findDomain(state, domainName)
  if (!domain) return []
  // UI 003's stored mailboxes join UI 002's domain addresses, once each.
  const stored = state.mailboxes.filter((mailbox) => mailbox.domain === domain.name).map(addressOf)
  const seen = new Set<string>()
  return [...mailboxAddresses(domain), ...stored].filter((address) => {
    const key = address.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function allMailboxes(state: ScenarioState): string[] {
  return state.domains.flatMap((domain) => mailboxesOf(state, domain.name))
}

/** The stored address of a mailbox, compared ignoring letter case, or undefined. */
export function findMailbox(state: ScenarioState, raw: string): string | undefined {
  const parts = splitAddress(normaliseAddress(raw))
  if (!parts || parts.local === '') return undefined
  const wanted = `${parts.local}@${parts.domain}`.toLowerCase()
  return mailboxesOf(state, parts.domain).find((address) => address.toLowerCase() === wanted)
}

/** The primary domain of an alias's domain: the target of an alias domain, else the domain. */
export function primaryDomainOf(state: ScenarioState, domain: string): string {
  return findAliasDomain(state, domain)?.target ?? domain
}

/** Whether the account reaches a domain or alias domain (legacy `hasDomainAccess`). */
export function reachesDomain(state: ScenarioState, account: MockAccount, name: string): boolean {
  const domain = findDomain(state, name)
  const aliasDomain = findAliasDomain(state, name)
  if (account.role === 'admin') return !!domain || !!aliasDomain
  if (account.scope.type !== 'domains') return false
  const scope = account.scope.domains
  if (domain) return scope.includes(domain.name)
  return (
    !!aliasDomain && scope.includes(aliasDomain.target) && !!findDomain(state, aliasDomain.target)
  )
}

/** A domain (not an alias domain) of the account's scope, or undefined. */
export function domainInScope(
  state: ScenarioState,
  account: MockAccount,
  raw: string,
): MockDomain | undefined {
  const name = domainKey(raw)
  const domain = name ? findDomain(state, name) : undefined
  if (!domain) return undefined
  if (account.role === 'admin') return domain
  return account.scope.type === 'domains' && account.scope.domains.includes(domain.name)
    ? domain
    : undefined
}

/** Administrators see every alias, orphaned ones included; domain administrators their scope. */
export function aliasInScope(
  state: ScenarioState,
  account: MockAccount,
  alias: MockAlias,
): boolean {
  return account.role === 'admin' || reachesDomain(state, account, domainPart(alias.address))
}

export function aliasDomainInScope(
  state: ScenarioState,
  account: MockAccount,
  item: MockAliasDomain,
): boolean {
  if (account.role === 'admin') return true
  return account.scope.type === 'domains' && account.scope.domains.includes(item.target)
}

export function resourceInScope(
  state: ScenarioState,
  account: MockAccount,
  resource: MockResource,
): boolean {
  return !!domainInScope(state, account, domainPart(resource.address))
}

/** An alias by its path identifier, within the account's scope. */
export function findAliasFor(
  state: ScenarioState,
  account: MockAccount,
  rawId: string | number,
): MockAlias | undefined {
  const id = Number(rawId)
  const alias = state.aliases.find((item) => item.id === id)
  return alias && aliasInScope(state, account, alias) ? alias : undefined
}

export function findAliasDomainFor(
  state: ScenarioState,
  account: MockAccount,
  raw: string,
): MockAliasDomain | undefined {
  const name = domainKey(raw)
  const item = name ? findAliasDomain(state, name) : undefined
  return item && aliasDomainInScope(state, account, item) ? item : undefined
}

export function findResourceFor(
  state: ScenarioState,
  account: MockAccount,
  raw: string,
): MockResource | undefined {
  const wanted = normaliseAddress(safeDecode(raw)).toLowerCase()
  const resource = state.resources.find((item) => item.address.toLowerCase() === wanted)
  return resource && resourceInScope(state, account, resource) ? resource : undefined
}

/** A path parameter that may still be percent-encoded. */
export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const materialised = new WeakSet<MockDomain>()

/**
 * UI 002's scenarios name a domain's aliases as explicit `aliasAddresses` (the footer exclusions).
 * They are stored as aliases the first time an alias operation runs, once per domain, so that the
 * full handlers serve them; addresses generated from the usage counts are not.
 */
export function materialiseDomainAliases(state: ScenarioState): void {
  for (const domain of state.domains) {
    if (!domain.aliasAddresses || materialised.has(domain)) continue
    materialised.add(domain)
    const first = mailboxAddresses(domain)[0]
    for (const address of domain.aliasAddresses) {
      const key = address.toLowerCase()
      if (state.aliases.some((alias) => alias.address.toLowerCase() === key)) continue
      const id = Math.max(state.lastAliasId, ...state.aliases.map((alias) => alias.id)) + 1
      state.lastAliasId = id
      state.aliases.push(
        mockAlias(
          first
            ? { id, address, destinations: [first] }
            : { id, address, destinationType: 'discard' },
        ),
      )
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Addresses in use, external destinations and the alias limit

export type Holder = 'mailbox' | 'resource' | 'alias' | 'temporaryAlias'

/** Who holds an address (API research R7), or null; `aliasId` does not count (an address change). */
export function holderOf(
  state: ScenarioState,
  address: string,
  options: { aliasId?: number } = {},
): Holder | null {
  const key = address.toLowerCase()
  if (!address.startsWith('@') && findMailbox(state, address)) return 'mailbox'
  if (state.resources.some((resource) => resource.address.toLowerCase() === key)) return 'resource'
  if (
    state.aliases.some(
      (alias) => alias.id !== options.aliasId && alias.address.toLowerCase() === key,
    )
  ) {
    return 'alias'
  }
  if (state.temporaryAliasAddresses.some((item) => item.toLowerCase() === key))
    return 'temporaryAlias'
  const parts = splitAddress(address)
  if (parts && parts.local !== '') {
    const aliasDomain = findAliasDomain(state, parts.domain.toLowerCase())
    if (aliasDomain && findMailbox(state, `${parts.local}@${aliasDomain.target}`)) return 'mailbox'
  }
  return null
}

export function addressInUse(address: string, holder: Holder): Response {
  return problem(409, 'address-in-use', { address, holder })
}

/** External: the domain is neither an active domain nor an active alias domain of the server. */
export function isExternal(state: ScenarioState, address: string): boolean {
  const name = domainPart(address)
  if (findDomain(state, name)?.active) return false
  const aliasDomain = findAliasDomain(state, name)
  return !(aliasDomain && aliasDomainValues(aliasDomain).active)
}

/** `409 domain-alias-limit-reached` when `requested` more aliases do not fit the primary domain. */
export function limitProblem(
  state: ScenarioState,
  primary: string,
  requested: number,
): Response | null {
  const domain = findDomain(state, primary)
  if (!domain || requested < 1) return null
  const count = domain.usage.aliases
  if (count + requested <= domain.maxAliases) return null
  return problem(409, 'domain-alias-limit-reached', {
    domain: primary,
    count,
    limit: domain.maxAliases,
    requested,
  })
}

/** The primary domain's aliases in use (UI 002's usage figure) change with creations and deletions. */
export function adjustAliasUsage(state: ScenarioState, primary: string, delta: number): void {
  const domain = findDomain(state, primary)
  if (domain) domain.usage = { ...domain.usage, aliases: Math.max(0, domain.usage.aliases + delta) }
}

// ---------------------------------------------------------------------------------------------
// Representations

export function aliasView(state: ScenarioState, alias: MockAlias): Alias {
  const domain = domainPart(alias.address)
  const aliasDomain = findAliasDomain(state, domain)
  const primary = aliasDomain?.target ?? domain
  return {
    id: alias.id,
    address: alias.address,
    addressUnicode: readableAddress(alias.address),
    kind: alias.address.startsWith('@') ? 'catchAll' : 'regular',
    domain,
    domainUnicode: readableName(domain),
    inAliasDomain: !!aliasDomain,
    primaryDomain: primary,
    primaryDomainUnicode: readableName(primary),
    destinationType: alias.destinationType,
    destinations: alias.destinationType === 'addresses' ? [...alias.destinations] : [],
    destinationsUnicode:
      alias.destinationType === 'addresses' ? alias.destinations.map(readableAddress) : [],
    active: alias.active,
    senderAllowed: alias.senderAllowed,
    groupwareVisible: alias.groupwareVisible,
    internal: alias.internal,
    publicComment: alias.publicComment,
    privateComment: alias.privateComment,
    createdAt: alias.createdAt,
    modifiedAt: alias.modifiedAt,
    orphaned: !findDomain(state, domain) && !aliasDomain,
    etag: aliasEtag(alias),
  }
}

export function aliasDomainView(state: ScenarioState, item: MockAliasDomain): AliasDomain {
  const values = aliasDomainValues(item)
  return {
    name: values.name,
    nameUnicode: readableName(values.name),
    targetDomain: values.target,
    targetDomainUnicode: readableName(values.target),
    active: values.active,
    targetIsRelayDomain: !!findDomain(state, values.target)?.backupMx,
    aliasCount: state.aliases.filter((alias) => domainPart(alias.address) === values.name).length,
    rateLimit: values.rateLimit ? { ...values.rateLimit } : null,
    createdAt: values.createdAt,
    modifiedAt: values.modifiedAt,
    etag: aliasDomainEtag(item),
  }
}

export function resourceView(resource: MockResource): Resource {
  const domain = domainPart(resource.address)
  return {
    address: resource.address,
    addressUnicode: readableAddress(resource.address),
    description: resource.description,
    kind: resource.kind,
    domain,
    domainUnicode: readableName(domain),
    bookingRule: resource.bookingRule,
    bookingLimit: resource.bookingRule === 'limited' ? resource.bookingLimit : null,
    active: resource.active,
    createdAt: resource.createdAt,
    modifiedAt: resource.modifiedAt,
    etag: resourceEtag(resource),
  }
}

// ---------------------------------------------------------------------------------------------
// Sender settings (API research R14, R15)

export type SenderEntryType = 'address' | 'domain' | 'anyAddress'

export interface SenderEntry {
  value: string
  type: SenderEntryType
}

/** An explicit permission in stored form (`*`, `@<ascii domain>` or an address), or null. */
export function explicitEntry(raw: string): SenderEntry | null {
  const value = raw.trim()
  if (value === '*') return { value, type: 'anyAddress' }
  if (value.includes('@') && !value.startsWith('@')) {
    const address = normaliseAddress(value)
    return isValidEmail(address) ? { value: address, type: 'address' } : null
  }
  const name = domainKey(value.startsWith('@') ? value.slice(1) : value)
  return name && isValidDomainName(name) ? { value: `@${name}`, type: 'domain' } : null
}

/** An external sender address in stored form (an address or `@<ascii domain>`), or null. */
export function externalEntry(raw: string): { value: string; domain: string } | null {
  const value = raw.trim()
  if (value.includes('@') && !value.startsWith('@')) {
    const address = normaliseAddress(value)
    return isValidEmail(address) ? { value: address, domain: domainPart(address) } : null
  }
  const name = domainKey(value.startsWith('@') ? value.slice(1) : value)
  return name && isValidDomainName(name) && name.includes('.')
    ? { value: `@${name}`, domain: name }
    : null
}

export function storedEntry(value: string): SenderEntry {
  if (value === '*') return { value, type: 'anyAddress' }
  return { value, type: value.startsWith('@') ? 'domain' : 'address' }
}

/** Whether an alias row (aliases and the mailboxes' own rows) has this address. */
export function hasAliasRow(state: ScenarioState, address: string): boolean {
  const key = address.toLowerCase()
  return (
    !!findMailbox(state, address) ||
    state.aliases.some((alias) => alias.address.toLowerCase() === key)
  )
}

export function kindOf(state: ScenarioState, entry: SenderEntry): MailboxSenderPermission['kind'] {
  if (entry.type === 'anyAddress') return 'anyAddress'
  if (entry.type === 'domain') {
    const name = entry.value.slice(1).toLowerCase()
    if (findDomain(state, name)) return 'domain'
    return findAliasDomain(state, name) ? 'aliasDomain' : null
  }
  if (findMailbox(state, entry.value)) return 'mailbox'
  const key = entry.value.toLowerCase()
  return state.aliases.some((alias) => alias.address.toLowerCase() === key) ? 'alias' : null
}

/** Administrators change every entry; domain administrators those in their scope, never `*`. */
export function changeable(
  state: ScenarioState,
  account: MockAccount,
  entry: SenderEntry,
): boolean {
  if (account.role === 'admin') return true
  if (entry.type === 'anyAddress') return false
  if (entry.type === 'domain')
    return reachesDomain(state, account, entry.value.slice(1).toLowerCase())
  return hasAliasRow(state, entry.value) && reachesDomain(state, account, domainPart(entry.value))
}

export const deliversTo = (alias: MockAlias, mailbox: string): boolean =>
  alias.destinationType === 'addresses' &&
  alias.destinations.some((destination) => destination.toLowerCase() === mailbox.toLowerCase())

/** Addresses that already let the mailbox send (legacy `fixed_sender_aliases_allowed`), lower case. */
export function allowedThroughAliases(state: ScenarioState, mailbox: string): string[] {
  return [
    mailbox.toLowerCase(),
    ...state.aliases
      .filter(
        (alias) =>
          !alias.address.startsWith('@') && alias.senderAllowed && deliversTo(alias, mailbox),
      )
      .map((alias) => alias.address.toLowerCase()),
  ]
}

/** The alias-domain addresses of a mailbox. */
export function aliasDomainAddressesOf(state: ScenarioState, mailbox: string): string[] {
  const parts = splitAddress(mailbox)
  if (!parts) return []
  return state.aliasDomains
    .filter((item) => item.target === parts.domain)
    .map((item) => item.name)
    .sort()
    .map((name) => `${parts.local}@${name}`)
}

const RANK: Record<SenderEntryType, number> = { anyAddress: 0, domain: 1, address: 2 }

export function compareText(a: string, b: string): number {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  return left < right ? -1 : left > right ? 1 : a < b ? -1 : a > b ? 1 : 0
}

export function senderSettingsView(
  state: ScenarioState,
  account: MockAccount,
  mailbox: string,
): MailboxSenderSettings {
  const rows = rowsOf(state.senderAcl, mailbox)
  const explicit = rows.filter((row) => !row.external).map((row) => storedEntry(row.sendAs))
  explicit.sort((a, b) => RANK[a.type] - RANK[b.type] || compareText(a.value, b.value))
  const external = rows
    .filter((row) => row.external)
    .map((row) => row.sendAs)
    .sort(compareText)
  const own: MailboxImplicitSenderAddress = {
    address: mailbox,
    addressUnicode: readableAddress(mailbox),
    source: 'ownAddress',
    aliasId: null,
    senderAllowed: true,
    catchAll: false,
  }
  const aliasDomainAddresses = aliasDomainAddressesOf(state, mailbox).map(
    (address): MailboxImplicitSenderAddress => ({
      address,
      addressUnicode: readableAddress(address),
      source: 'aliasDomainAddress',
      aliasId: null,
      senderAllowed: true,
      catchAll: false,
    }),
  )
  const aliases = state.aliases
    .filter((alias) => deliversTo(alias, mailbox))
    .sort((a, b) => (a.address < b.address ? -1 : a.address > b.address ? 1 : 0))
    .map((alias): MailboxImplicitSenderAddress => ({
      address: alias.address,
      addressUnicode: readableAddress(alias.address),
      source: 'alias',
      aliasId: alias.id,
      senderAllowed: alias.senderAllowed,
      catchAll: alias.address.startsWith('@'),
    }))
  return {
    mailbox,
    mailboxUnicode: readableAddress(mailbox),
    implicitAddresses: [own, ...aliasDomainAddresses, ...aliases],
    explicitPermissions: explicit.map((entry) => {
      const kind = kindOf(state, entry)
      return {
        value: entry.value,
        valueUnicode: entry.type === 'anyAddress' ? '*' : readableAddress(entry.value),
        type: entry.type,
        kind,
        changeable: changeable(state, account, entry),
        stale: kind === null,
      }
    }),
    senderCheckDisabled: explicit.some((entry) => entry.type === 'anyAddress'),
    externalSenderAddresses: external,
    externalSenderAddressesUnicode: external.map(readableAddress),
    etag: senderSettingsEtag(state.senderAcl, mailbox),
  }
}

/** A mailbox (never a resource) of the account's scope, by any spelling of its address. */
export function mailboxFor(
  state: ScenarioState,
  account: MockAccount,
  raw: string,
): string | undefined {
  const mailbox = findMailbox(state, safeDecode(raw))
  if (!mailbox) return undefined
  return domainInScope(state, account, domainPart(mailbox)) ? mailbox : undefined
}

// ---------------------------------------------------------------------------------------------
// Alias validation (API research R3, R4, R5; data-model §6)

export interface DestinationInput {
  destinationType?: string
  destinations?: string[]
}

export interface ParsedDestination {
  type: MockAlias['destinationType']
  addresses: string[]
}

/** The alias address: valid, in a reached domain; with the violations of `address`. */
export function checkAliasAddress(
  state: ScenarioState,
  account: MockAccount,
  raw: string,
  errors: Violations,
): string | null {
  const address = normaliseAddress(raw)
  if (!isValidAliasAddress(address)) {
    addViolation(errors, 'address', 'invalidFormat', { format: 'aliasAddress' })
    return null
  }
  if (!reachesDomain(state, account, domainPart(address))) {
    addViolation(errors, 'address', 'notFound', { resource: 'domain' })
    return null
  }
  return address
}

/**
 * The destination a request sends (`null` when it sends none), and the normalised valid entries by
 * the index sent, with the violations of `destinations` and `destinations.N`.
 */
export function parseDestination(
  body: DestinationInput,
  current: ParsedDestination | null,
  errors: Violations,
): { destination: ParsedDestination | null; indexes: Map<number, string> } {
  const indexes = new Map<number, string>()
  const hasType = body.destinationType !== undefined
  const hasList = body.destinations !== undefined
  if (!hasType && !hasList) return { destination: null, indexes }
  const type = (body.destinationType ?? 'addresses') as ParsedDestination['type']
  if (type !== 'addresses') {
    if (hasList) {
      addViolation(errors, 'destinations', 'conflictsWith', { field: 'destinationType' })
      return { destination: null, indexes }
    }
    return { destination: { type, addresses: [] }, indexes }
  }
  if (!hasList) {
    if (current && current.type === 'addresses') return { destination: current, indexes }
    addViolation(errors, 'destinations', 'required')
    return { destination: null, indexes }
  }
  let valid = true
  ;(body.destinations ?? []).forEach((raw, index) => {
    const address = normaliseAddress(raw)
    if (address.startsWith('@') || !isValidEmail(address)) {
      addViolation(errors, `destinations.${index}`, 'invalidFormat', { format: 'email' })
      valid = false
      return
    }
    indexes.set(index, address)
  })
  if (indexes.size === 0 && valid) {
    addViolation(errors, 'destinations', 'required')
    return { destination: null, indexes }
  }
  const unique = new Map<string, string>()
  for (const address of indexes.values()) {
    if (!unique.has(address.toLowerCase())) unique.set(address.toLowerCase(), address)
  }
  return { destination: { type: 'addresses', addresses: [...unique.values()] }, indexes }
}

/** The destinations added compared with the stored ones (all of them on creation), lower case. */
export function addedDestinations(
  destination: ParsedDestination,
  stored: ParsedDestination | null,
) {
  const before = new Set((stored?.addresses ?? []).map((item) => item.toLowerCase()))
  return new Set(
    destination.addresses.map((item) => item.toLowerCase()).filter((item) => !before.has(item)),
  )
}

/** The rules per destination entry and the joined length (`destinations.N`, `destinations`). */
export function checkDestinations(
  state: ScenarioState,
  destination: ParsedDestination,
  address: string,
  indexes: Map<number, string>,
  stored: ParsedDestination | null,
  errors: Violations,
): void {
  if (destination.type !== 'addresses') return
  const added = addedDestinations(destination, stored)
  const disabled = state.capabilities004.externalDestinationsDisabled
  for (const [index, entry] of indexes) {
    const key = entry.toLowerCase()
    if (key === address.toLowerCase()) {
      addViolation(errors, `destinations.${index}`, 'conflictsWith', {
        field: 'address',
        value: address,
      })
    } else if (state.resources.some((resource) => resource.address.toLowerCase() === key)) {
      addViolation(errors, `destinations.${index}`, 'notEligible', { kind: 'resource' })
    } else if (disabled && added.has(key) && isExternal(state, entry)) {
      addViolation(errors, `destinations.${index}`, 'notEligible', { kind: 'externalDestination' })
    }
  }
  const max = state.capabilities004.destinationsMaxLength
  if (destination.addresses.join(',').length > max) {
    addViolation(errors, 'destinations', 'tooLong', { max, unit: 'characters' })
  }
}

/** `403 attribute-not-permitted` for the external destinations a domain administrator adds without the flag. */
export function externalRefusal(
  state: ScenarioState,
  account: MockAccount,
  destination: ParsedDestination,
  indexes: Map<number, string>,
  stored: ParsedDestination | null,
): Response | null {
  if (account.role === 'admin' || destination.type !== 'addresses') return null
  if (account.permissions.aliasExternalGoto) return null
  const added = addedDestinations(destination, stored)
  const refused: Record<string, string> = {}
  for (const [index, entry] of indexes) {
    if (added.has(entry.toLowerCase()) && isExternal(state, entry)) {
      refused[`destinations.${index}`] = 'aliasExternalGoto'
    }
  }
  const attributes = Object.keys(refused)
  if (attributes.length === 0) return null
  return problem(403, 'attribute-not-permitted', { attributes, requiredFlags: refused })
}

export function checkComment(
  state: ScenarioState,
  field: 'publicComment' | 'privateComment',
  value: string,
  errors: Violations,
): void {
  const max = state.capabilities004.commentMaxBytes
  if (Buffer.byteLength(value, 'utf8') > max)
    addViolation(errors, field, 'tooLong', { max, unit: 'bytes' })
}

/** After a save that allows sending: explicit permissions of the destinations to send as the address go. */
export function dropRedundantPermissions(state: ScenarioState, alias: MockAlias): void {
  if (!alias.senderAllowed || alias.destinationType !== 'addresses') return
  const key = alias.address.toLowerCase()
  const destinations = new Set(alias.destinations.map((item) => item.toLowerCase()))
  state.senderAcl = state.senderAcl.filter(
    (row) =>
      row.external ||
      row.sendAs.toLowerCase() !== key ||
      !destinations.has(row.mailbox.toLowerCase()),
  )
}

// ---------------------------------------------------------------------------------------------
// Deletions and cascades

export function removeAlias(state: ScenarioState, alias: MockAlias): void {
  state.aliases = state.aliases.filter((item) => item.id !== alias.id)
  const key = alias.address.toLowerCase()
  state.senderAcl = state.senderAcl.filter(
    (row) => row.external || row.sendAs.toLowerCase() !== key,
  )
  adjustAliasUsage(state, primaryDomainOf(state, domainPart(alias.address)), -1)
}

/** The cascade of an alias domain deletion (API research R11); the DKIM key is kept. */
export function removeAliasDomain(state: ScenarioState, item: MockAliasDomain): void {
  const name = item.name
  const inside = state.aliases.filter((alias) => domainPart(alias.address) === name)
  for (const alias of inside) {
    state.aliases = state.aliases.filter((other) => other.id !== alias.id)
    const key = alias.address.toLowerCase()
    state.senderAcl = state.senderAcl.filter(
      (row) => row.external || row.sendAs.toLowerCase() !== key,
    )
  }
  adjustAliasUsage(state, item.target, -inside.length)
  state.senderAcl = state.senderAcl.filter(
    (row) => row.external || row.sendAs.toLowerCase() !== `@${name}`,
  )
  state.temporaryAliasAddresses = state.temporaryAliasAddresses.filter(
    (address) => domainPart(address) !== name,
  )
  const footer = state.footers[item.target]
  if (footer) {
    footer.excludedAliasDomains = footer.excludedAliasDomains.filter(
      (excluded) => excluded !== name,
    )
  }
  state.aliasDomains = state.aliasDomains.filter((other) => other.name !== name)
}

export function removeResource(state: ScenarioState, resource: MockResource): void {
  state.resources = state.resources.filter((item) => item !== resource)
  const domain = findDomain(state, domainPart(resource.address))
  if (domain) domain.usage = { ...domain.usage, resources: Math.max(0, domain.usage.resources - 1) }
}

// ---------------------------------------------------------------------------------------------
// Versions, failures and bulk results

export const bareVersion = (value: string) => value.trim().replaceAll('"', '')

/** `If-Match` that names another version (`*` matches every version). */
export function ifMatchFails(header: string | null, etag: string): boolean {
  if (header === null) return false
  const value = header.trim()
  return value !== '*' && bareVersion(value) !== bareVersion(etag)
}

export const temporaryFailure = () =>
  problem(503, 'temporary-failure', { dependency: 'sharedStore' }, { 'Retry-After': '30' })

export async function problemOf(answer: Response): Promise<Problem> {
  return (await answer.json()) as Problem
}

export function bulkResult(state: ScenarioState, results: BulkItemResult[]): BulkResult {
  const count = (outcome: BulkItemResult['outcome']) =>
    results.filter((item) => item.outcome === outcome).length
  return {
    bulkRequestId: Buffer.from(`b${state.now()}`).toString('hex').padEnd(32, '0').slice(0, 32),
    results,
    summary: {
      total: results.length,
      done: count('done'),
      notFound: count('notFound'),
      refused: count('refused'),
      outdated: count('outdated'),
      failed: count('failed'),
    },
  }
}

/** `422 tooMany` on `targets` above the bulk limit of the capabilities. */
export function tooManyTargets(state: ScenarioState, count: number, errors: Violations): boolean {
  const max = state.capabilities004.bulkLimit
  if (count <= max) return false
  addViolation(errors, 'targets', 'tooMany', { max })
  return true
}

/** Read-only members sent with a value other than the current one (`immutable`). */
export function immutableMembers(
  body: Record<string, unknown>,
  readOnly: readonly string[],
  current: Record<string, unknown>,
  errors: Violations,
): void {
  for (const member of readOnly) {
    if (!(member in body)) continue
    if (JSON.stringify(body[member]) !== JSON.stringify(current[member])) {
      addViolation(errors, member, 'immutable')
    }
  }
}
