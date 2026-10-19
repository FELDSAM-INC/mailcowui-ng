// DKIM key factory (UI 010 research R24): real RSA key pairs from node:crypto up to 2,048 bits,
// memoised per size and pool slot (larger keys are synthetic, see `rsaKeyPair`), and the contract
// `DkimKey`
// the handlers answer with. The record is derived as the API documents it: name
// `<selector>._domainkey.<name>`, value `v=DKIM1;k=rsa;t=s;s=email;p=<public key>`, split into
// pieces of at most 255 characters. The private key never leaves the mock except through the
// export handler.
import { createHash, generateKeyPairSync } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { DkimKey, DkimKeyDetails, DkimKeyKind, DkimKeyState } from '@/api'

import type { MockAccount, MockDkimKey, ScenarioState } from '../scenarios/state'
import { asciiName, readableName } from './domain'

/** How many different key pairs per size up to 2,048 bits the mock rotates through. */
const POOL = 4

interface KeyPair {
  publicKey: string
  privateKeyPem: string
}

const pairs = new Map<string, KeyPair>()

/**
 * Generated pairs are kept on disk (in node_modules' cache, never committed), so that each machine
 * generates the slow 3,072- and 4,096-bit keys once instead of once per test worker.
 */
const CACHE_DIR = join(process.cwd(), 'node_modules/.cache/mailcowui-ng-mock-keys/')

function readCached(id: string): KeyPair | null {
  try {
    const pair = JSON.parse(readFileSync(`${CACHE_DIR}${id}.json`, 'utf8')) as KeyPair
    return typeof pair.publicKey === 'string' && typeof pair.privateKeyPem === 'string'
      ? pair
      : null
  } catch {
    return null
  }
}

function writeCached(id: string, pair: KeyPair): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true })
    const temporary = `${CACHE_DIR}${id}.${process.pid}.tmp`
    writeFileSync(temporary, JSON.stringify(pair))
    renameSync(temporary, `${CACHE_DIR}${id}.json`)
  } catch {
    // A read-only checkout: the pair is generated again next time.
  }
}

/** Deterministic bytes of the given length, standing in for a large key's DER public key. */
function syntheticBytes(seed: string, length: number): Buffer {
  const chunks: Buffer[] = []
  for (let counter = 0; chunks.length * 32 < length; counter += 1) {
    chunks.push(createHash('sha256').update(`${seed}:${counter}`).digest())
  }
  return Buffer.concat(chunks).subarray(0, length)
}

/**
 * A memoised RSA key pair: base64 DER SPKI public key and PKCS#8 PEM private key; sizes up to 2,048
 * bits rotate through a small pool. Keys above 2,048 bits are not generated: on a loaded machine a
 * 4,096-bit key takes long enough to stall the mock server for every test. Their public key is
 * deterministic data of the length a real one has (the screens only show it), and their private
 * key is a 2,048-bit PEM; imports are checked with the real PEM fixtures instead.
 */
export function rsaKeyPair(size: number, slot = 0): KeyPair {
  if (size > 2048) {
    const id = `rsa-${size}`
    let pair = pairs.get(id)
    if (!pair) {
      const base = rsaKeyPair(2048, 0)
      pair = {
        publicKey: syntheticBytes(id, 294 + (size - 2048) / 8).toString('base64'),
        privateKeyPem: base.privateKeyPem,
      }
      pairs.set(id, pair)
    }
    return pair
  }
  const id = `rsa-${size}-${slot % POOL}`
  let pair = pairs.get(id) ?? readCached(id)
  if (!pair) {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: size,
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })
    pair = { publicKey: publicKey.toString('base64'), privateKeyPem: privateKey }
    writeCached(id, pair)
  }
  pairs.set(id, pair)
  return pair
}

let generated = 0

/** A complete stored key of `size` bits with a selector; each call takes the next pool slot. */
export function mockDkimKey(
  options: { size?: number; selector?: string; slot?: number } = {},
): MockDkimKey {
  const size = options.size ?? 2048
  const pair = rsaKeyPair(size, options.slot ?? generated++)
  return {
    selector: options.selector ?? 'dkim',
    keyLength: size,
    publicKey: pair.publicKey,
    privateKeyPem: pair.privateKeyPem,
    version: 1,
  }
}

/** An incomplete key: only the given parts are stored. */
export function incompleteDkimKey(parts: Partial<Omit<MockDkimKey, 'version'>>): MockDkimKey {
  return {
    selector: null,
    keyLength: null,
    publicKey: null,
    privateKeyPem: null,
    version: 1,
    ...parts,
  }
}

/** The quoted, strong version tag of a stored key. */
export function dkimEtag(name: string, key: MockDkimKey): string {
  const hash = createHash('sha256')
    .update(JSON.stringify([name, key.selector, key.publicKey, key.privateKeyPem, key.version]))
    .digest('hex')
    .slice(0, 24)
  return `"${hash}"`
}

/** The TXT value of a public key. */
export const dkimValue = (publicKey: string) => `v=DKIM1;k=rsa;t=s;s=email;p=${publicKey}`

/** Pieces of at most 255 characters, joined equal to the value. */
export function valueParts(value: string): string[] {
  const parts: string[] = []
  for (let index = 0; index < value.length; index += 255)
    parts.push(value.slice(index, index + 255))
  return parts
}

/** The contract key details of a stored key. */
export function keyDetails(name: string, key: MockDkimKey): DkimKeyDetails {
  const missingParts: DkimKeyDetails['missingParts'] = []
  if (!key.publicKey) missingParts.push('publicKey')
  if (!key.selector) missingParts.push('selector')
  if (!key.privateKeyPem) missingParts.push('privateKey')
  const record =
    key.selector && key.publicKey
      ? {
          name: `${key.selector}._domainkey.${name}`,
          type: 'TXT' as const,
          value: dkimValue(key.publicKey),
          valueParts: valueParts(dkimValue(key.publicKey)),
        }
      : null
  return {
    selector: key.selector,
    keyLength: key.publicKey ? key.keyLength : null,
    publicKey: key.publicKey,
    record,
    complete: missingParts.length === 0,
    missingParts,
  }
}

/** One DKIM entry of the scope: a domain, an alias domain or an unused key. */
export interface DnsEntry {
  /** The entry's API name: ASCII for domains and alias domains, the stored spelling otherwise. */
  name: string
  displayName: string
  kind: DkimKeyKind
  targetDomain: string | null
  key: MockDkimKey | undefined
}

/** The domains of an account's scope (ASCII names). */
function domainScope(state: ScenarioState, account: MockAccount): string[] {
  if (account.role === 'admin') return state.domains.map((domain) => domain.name)
  if (account.role !== 'domainAdmin' || account.scope.type !== 'domains') return []
  const names = new Set(account.scope.domains)
  return state.domains.filter((domain) => names.has(domain.name)).map((domain) => domain.name)
}

/** Every DKIM entry the account may see: domains, their alias domains and (administrators) unused keys. */
export function dnsEntries(state: ScenarioState, account: MockAccount): DnsEntry[] {
  const domains = domainScope(state, account)
  const domainSet = new Set(domains)
  const entries: DnsEntry[] = domains.map((name) => ({
    name,
    displayName: readableName(name),
    kind: 'domain',
    targetDomain: null,
    key: state.dns.keys[name],
  }))
  for (const alias of state.aliasDomains) {
    if (!domainSet.has(alias.target)) continue
    entries.push({
      name: alias.name,
      displayName: readableName(alias.name),
      kind: 'aliasDomain',
      targetDomain: alias.target,
      key: state.dns.keys[alias.name],
    })
  }
  if (account.role === 'admin') {
    const known = new Set([
      ...state.domains.map((domain) => domain.name),
      ...state.aliasDomains.map((alias) => alias.name),
    ])
    for (const [name, key] of Object.entries(state.dns.keys)) {
      if (known.has(name) || known.has(asciiName(name))) continue
      const ascii = asciiName(name)
      entries.push({
        name,
        displayName: ascii === name ? readableName(name) : name,
        kind: 'none',
        targetDomain: null,
        key,
      })
    }
  }
  return entries
}

/** An entry by its API name: the exact stored spelling first, then the normalised name. */
export function findEntry(
  state: ScenarioState,
  account: MockAccount,
  raw: string,
): DnsEntry | undefined {
  const entries = dnsEntries(state, account)
  const exact = entries.find((entry) => entry.name === raw)
  if (exact) return exact
  const normal = asciiName(raw)
  return normal ? entries.find((entry) => asciiName(entry.name) === normal) : undefined
}

export function entryState(entry: DnsEntry): DkimKeyState {
  if (entry.kind === 'none') return 'unused'
  return entry.key ? 'valid' : 'missing'
}

/** The contract `DkimKey` of an entry. */
export function dkimKeyBody(entry: DnsEntry): DkimKey {
  return {
    name: entry.name,
    displayName: entry.displayName,
    kind: entry.kind,
    targetDomain: entry.targetDomain,
    state: entryState(entry),
    key: entry.key ? keyDetails(entry.name, entry.key) : null,
    etag: entry.key ? dkimEtag(entry.name, entry.key) : null,
  }
}
