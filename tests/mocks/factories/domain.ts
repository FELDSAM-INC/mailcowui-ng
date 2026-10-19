// Domain factory (UI 002 research D28): stored settings plus usage inputs, and the contract
// `Domain` the handlers answer with. Names go through node:url's UTS #46 conversion, as the API
// normalises them; quotas are bytes in whole MiB; tags are kept once ignoring letter case and
// sorted; the version tag hashes the stored settings and tags only, never the usage.
import { createHash } from 'node:crypto'
import { domainToASCII, domainToUnicode } from 'node:url'

import type { Domain, DomainUsage } from '@/api'

import type { MockDomain, MockDomainUsage, ScenarioState } from '../scenarios/state'
import { footerSummary } from './domain-footer'

export const MIB = 1_048_576
export const GIB = 1024 * MIB

/** The API's conversion of a domain name: trimmed, lower-cased, UTS #46 ASCII ('' when invalid). */
export function asciiName(input: string): string {
  return domainToASCII(input.trim().toLowerCase())
}

/** The readable form of an ASCII name. */
export function readableName(ascii: string): string {
  return domainToUnicode(ascii) || ascii
}

/** Tags trimmed, empty ones dropped, case-only duplicates kept once (first spelling), sorted. */
export function normaliseTags(tags: readonly string[]): string[] {
  const seen = new Map<string, string>()
  for (const raw of tags) {
    const tag = raw.trim()
    if (tag && !seen.has(tag.toLowerCase())) seen.set(tag.toLowerCase(), tag)
  }
  return [...seen.values()].sort(
    (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }) || a.localeCompare(b),
  )
}

export function emptyUsage(): MockDomainUsage {
  return {
    mailboxes: 0,
    resources: 0,
    aliases: 0,
    largestMailboxQuota: 0,
    quotaAllocated: 0,
    storageUsed: 0,
    messages: 0,
  }
}

/** A stored domain with the legacy defaults, overridden. */
export function mockDomain(overrides: Partial<MockDomain> & { name: string }): MockDomain {
  const name = asciiName(overrides.name) || overrides.name
  return {
    description: name,
    active: true,
    maxMailboxes: 10,
    maxAliases: 400,
    maxMailboxQuota: 10240 * MIB,
    domainQuota: 10240 * MIB,
    backupMx: false,
    relayAllRecipients: false,
    relayUnknownOnly: false,
    globalAddressList: true,
    relayhost: null,
    rateLimit: null,
    createdAt: '2026-01-05T08:00:00.000Z',
    modifiedAt: null,
    ...overrides,
    name,
    tags: normaliseTags(overrides.tags ?? []),
    usage: { ...emptyUsage(), ...overrides.usage },
  }
}

const STORED_KEYS = [
  'name',
  'description',
  'active',
  'maxMailboxes',
  'maxAliases',
  'maxMailboxQuota',
  'domainQuota',
  'backupMx',
  'relayAllRecipients',
  'relayUnknownOnly',
  'globalAddressList',
  'tags',
] as const satisfies readonly (keyof MockDomain)[]

/** A strong, quoted version tag of the stored settings and tags (never of the usage). */
export function domainEtag(domain: MockDomain): string {
  const stored: Record<string, unknown> = Object.fromEntries(
    STORED_KEYS.map((key) => [key, domain[key]]),
  )
  // UI 009: the relayhost assignment is part of the version tag (API FR-028); unset, the tag is
  // the one UI 002's scenarios always had.
  if (domain.relayhost) stored.relayhost = domain.relayhost.id
  return `"${createHash('sha256').update(JSON.stringify(stored)).digest('hex').slice(0, 24)}"`
}

/** Generated addresses, `<prefix><n>@<domain>`, for counts without explicit addresses. */
function generated(prefix: string, count: number, domain: string): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}${index + 1}@${domain}`)
}

export function mailboxAddresses(domain: MockDomain): string[] {
  return domain.mailboxAddresses ?? generated('user', domain.usage.mailboxes, domain.name)
}

export function resourceAddresses(domain: MockDomain): string[] {
  return domain.resourceAddresses ?? generated('room', domain.usage.resources, domain.name)
}

export function aliasAddresses(domain: MockDomain): string[] {
  return domain.aliasAddresses ?? generated('alias', domain.usage.aliases, domain.name)
}

/** Alias domains that point to a domain, sorted. */
export function aliasDomainsOf(state: ScenarioState, name: string): string[] {
  return state.aliasDomains
    .filter((alias) => alias.target === name)
    .map((alias) => alias.name)
    .sort()
}

/** Domain administrators assigned to a domain (from the accounts' scopes), sorted. */
export function domainAdminsOf(state: ScenarioState, name: string): string[] {
  return state.accounts
    .filter(
      (account) =>
        account.role === 'domainAdmin' &&
        account.scope.type === 'domains' &&
        account.scope.domains.includes(name),
    )
    .map((account) => account.username)
    .sort()
}

export function domainUsage(state: ScenarioState, domain: MockDomain): DomainUsage {
  const { usage } = domain
  const maxNewMailboxQuota = Math.max(
    0,
    Math.min(domain.maxMailboxQuota, domain.domainQuota - usage.quotaAllocated),
  )
  return {
    mailboxes: usage.mailboxes,
    resources: usage.resources,
    aliases: usage.aliases,
    aliasDomains: aliasDomainsOf(state, domain.name).length,
    mailboxesLeft: domain.maxMailboxes - usage.mailboxes,
    aliasesLeft: domain.maxAliases - usage.aliases,
    largestMailboxQuota: usage.largestMailboxQuota,
    quotaAllocated: usage.quotaAllocated,
    storageUsed: usage.storageUsed,
    messages: usage.messages,
    maxNewMailboxQuota,
  }
}

/** The contract representation; `domainAdmins` only for administrators. */
export function domainView(
  state: ScenarioState,
  domain: MockDomain,
  options: { admin: boolean },
): Domain {
  const view: Domain = {
    name: domain.name,
    unicodeName: readableName(domain.name),
    description: domain.description,
    active: domain.active,
    maxMailboxes: domain.maxMailboxes,
    maxAliases: domain.maxAliases,
    maxMailboxQuota: domain.maxMailboxQuota,
    domainQuota: domain.domainQuota,
    backupMx: domain.backupMx,
    relayAllRecipients: domain.relayAllRecipients,
    relayUnknownOnly: domain.relayUnknownOnly,
    globalAddressList: domain.globalAddressList,
    tags: [...domain.tags],
    relayhost: domain.relayhost ? { ...domain.relayhost } : null,
    rateLimit: domain.rateLimit ? { ...domain.rateLimit } : null,
    createdAt: domain.createdAt,
    modifiedAt: domain.modifiedAt,
    usage: domainUsage(state, domain),
    footer: footerSummary(state.footers[domain.name]),
    etag: domainEtag(domain),
  }
  if (options.admin) view.domainAdmins = domainAdminsOf(state, domain.name)
  return view
}
