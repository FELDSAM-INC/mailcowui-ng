// Alias factory and address helpers (UI 004 research R21, API research R3, R4, R18). Addresses are
// trimmed and split at the last `@`; the local part keeps its letter case and the domain part is
// converted to lower-case ASCII (UTS #46). The version tag hashes the stored settings of API
// data-model "Version tags" (`id, address, goto, domain, active, sender_allowed, sogo_visible,
// internal, public_comment, private_comment`).
import { createHash } from 'node:crypto'

import type { AliasDestinationType } from '@/api'

import type { MockAlias } from '../scenarios/state'
import { asciiName, readableName } from './domain'

export const SPECIAL_GOTO: Record<Exclude<AliasDestinationType, 'addresses'>, string> = {
  discard: 'null@localhost',
  learnSpam: 'spam@localhost',
  learnHam: 'ham@localhost',
}

/** The local part and the domain part of an address (split at the last `@`), or null. */
export function splitAddress(address: string): { local: string; domain: string } | null {
  const at = address.lastIndexOf('@')
  if (at < 0) return null
  return { local: address.slice(0, at), domain: address.slice(at + 1) }
}

/** The domain part of an address in lower case ('' without one). */
export function domainPart(address: string): string {
  return splitAddress(address)?.domain.toLowerCase() ?? ''
}

/**
 * The API's normalisation of an address: trimmed, the local part as given, the domain part in
 * lower-case ASCII. A domain part that does not convert is only lower-cased (it is then invalid).
 */
export function normaliseAddress(input: string): string {
  const value = input.trim()
  const parts = splitAddress(value)
  if (!parts) return value
  const domain = asciiName(parts.domain) || parts.domain.toLowerCase()
  return `${parts.local}@${domain}`
}

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/
const ATOM = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+"
const LOCAL = new RegExp(`^${ATOM}(\\.${ATOM})*$`)

/** A valid ASCII domain name (labels of at most 63 characters, at most 253 in all). */
export function isValidDomainName(name: string): boolean {
  return (
    name.length > 0 && name.length <= 253 && name.split('.').every((label) => LABEL.test(label))
  )
}

/** PHP's `FILTER_VALIDATE_EMAIL` as legacy uses it, on a normalised address. */
export function isValidEmail(address: string): boolean {
  const parts = splitAddress(address)
  if (!parts || parts.local.length === 0 || parts.local.length > 64) return false
  if (!LOCAL.test(parts.local)) return false
  const labels = parts.domain.split('.')
  return isValidDomainName(parts.domain) && labels.length >= 2 && /^[a-z]/.test(labels.at(-1) ?? '')
}

/** A valid alias address: an e-mail address, or `@` and a valid domain name (catch-all). */
export function isValidAliasAddress(address: string): boolean {
  if (address.startsWith('@')) return isValidDomainName(address.slice(1))
  return isValidEmail(address)
}

/** The address with its domain part in readable (Unicode) form. */
export function readableAddress(address: string): string {
  const parts = splitAddress(address)
  if (!parts) return address
  return `${parts.local}@${readableName(parts.domain)}`
}

/** The stored `goto` of an alias. */
export function gotoOf(alias: Pick<MockAlias, 'destinationType' | 'destinations'>): string {
  return alias.destinationType === 'addresses'
    ? alias.destinations.join(',')
    : SPECIAL_GOTO[alias.destinationType]
}

/** Strong, quoted version tag of an alias's stored settings. */
export function aliasEtag(alias: MockAlias): string {
  const stored = [
    alias.id,
    alias.address,
    gotoOf(alias),
    domainPart(alias.address),
    alias.active,
    alias.senderAllowed,
    alias.groupwareVisible,
    alias.internal,
    alias.publicComment,
    alias.privateComment,
  ]
  return `"${createHash('sha256').update(JSON.stringify(stored)).digest('hex').slice(0, 24)}"`
}

/** A stored alias with the legacy defaults, overridden; the address is normalised. */
export function mockAlias(
  overrides: Partial<MockAlias> & { id: number; address: string },
): MockAlias {
  return {
    destinationType: 'addresses',
    destinations: [],
    active: true,
    senderAllowed: true,
    groupwareVisible: true,
    internal: false,
    publicComment: '',
    privateComment: '',
    createdAt: '2026-02-01T09:00:00.000Z',
    modifiedAt: null,
    ...overrides,
    address: normaliseAddress(overrides.address),
  }
}
