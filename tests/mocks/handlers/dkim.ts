// DKIM and DNS capabilities handlers (UI 010 T007, T030, T043, T075, T089, T095): the documented
// behaviour of API 010 on the scenario state. Scope per role, the list's search, filters, sort and
// paging, lookups by stored or normalised name, version tags and If-Match, generation (with
// administrator-only overwrite), import (rule codes from node:crypto, the key never echoed), copy,
// deletion, bulk deletion with per-target outcomes, export and publication, each with the
// publication outcome the scenario injects.
import { createPrivateKey, createPublicKey, type KeyObject } from 'node:crypto'

import type {
  BulkItemResult,
  DkimDnsPublicationOutcome,
  DkimKey,
  DkimKeyChangeResult,
  DnsCapabilities,
} from '@/api'

import {
  dkimEtag,
  dkimKeyBody,
  dnsEntries,
  findEntry,
  mockDkimKey,
  type DnsEntry,
} from '../factories/dkim-key'
import { publicationOutcome } from '../factories/dkim-publication'
import { asciiName } from '../factories/domain'
import type { MockAccount, MockDkimKey, ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, scenario } from './context'
import {
  addViolation,
  compareValues,
  isValidAsciiDomain,
  notFound,
  outdated,
  page,
  requireAdmin,
  requireManager,
  utf8Bytes,
  validationFailed,
  type Violations,
} from './domain-rules'

const SELECTOR = /^[A-Za-z0-9._-]+$/

/** A path parameter as the API reads it. */
function pathName(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** The capabilities as a role sees them (API 010 FR-012). */
export function capabilitiesFor(state: ScenarioState, account: MockAccount): DnsCapabilities {
  const caps = state.dns.capabilities
  const admin = account.role === 'admin'
  return {
    serverHostname: state.serverHostname,
    defaultPageSize: caps.defaultPageSize,
    maxPageSize: caps.maxPageSize,
    dkim: {
      ...caps.dkim,
      privateKeyExportEnabled: admin ? caps.dkim.privateKeyExportEnabled : null,
    },
    mtaSts: { ...caps.mtaSts, modes: [...caps.mtaSts.modes] },
    dnsDiagnostics: {
      ...caps.dnsDiagnostics,
      serverChecks: admin && caps.dnsDiagnostics.serverChecks,
    },
  }
}

/** The publication outcome of a change: injected, `published`, or `notConfigured` while off. */
function publicationFor(
  state: ScenarioState,
  operationId: string,
  selector: string | null,
): DkimDnsPublicationOutcome {
  if (!state.dns.capabilities.dkim.dnsPublicationEnabled) return publicationOutcome('notConfigured')
  return (
    state.dns.publication[operationId] ??
    publicationOutcome('published', { selector: selector ?? 'dkim' })
  )
}

function changeResult(
  state: ScenarioState,
  entry: DnsEntry,
  operationId: string,
): DkimKeyChangeResult {
  return {
    ...dkimKeyBody(entry),
    dnsPublication: publicationFor(state, operationId, entry.key?.selector ?? null),
  }
}

/** The selector rules (`required`, `tooLong`, `invalidFormat`). */
function checkSelector(errors: Violations, state: ScenarioState, selector: string): void {
  const max = state.dns.capabilities.dkim.selectorMaxLength
  if (selector === '') addViolation(errors, 'selector', 'required')
  else if (selector.length > max) addViolation(errors, 'selector', 'tooLong', { max })
  else if (!SELECTOR.test(selector)) {
    addViolation(errors, 'selector', 'invalidFormat', { format: 'dkimSelector' })
  }
}

const SORT_VALUE: Record<string, (body: DkimKey) => string | number | null> = {
  name: (body) => body.name.toLowerCase(),
  state: (body) => body.state,
  selector: (body) => body.key?.selector ?? null,
  keyLength: (body) => body.key?.keyLength ?? null,
}

/** Sorted entries; entries without a value (no key) come last in ascending order. */
function sortEntries(items: DkimKey[], sort: string, descending: boolean): DkimKey[] {
  const value = SORT_VALUE[sort] ?? SORT_VALUE.name!
  const byName = (a: DkimKey, b: DkimKey) =>
    compareValues(a.name.toLowerCase(), b.name.toLowerCase())
  return [...items].sort((a, b) => {
    const left = value(a)
    const right = value(b)
    if (left === null && right !== null) return descending ? -1 : 1
    if (right === null && left !== null) return descending ? 1 : -1
    const order = left === null && right === null ? 0 : compareValues(left, right)
    return (descending ? -order : order) || byName(a, b)
  })
}

function storeKey(state: ScenarioState, name: string, key: MockDkimKey): void {
  state.dns.keys[name] = key
}

function nextVersion(previous: MockDkimKey | undefined): number {
  return (previous?.version ?? 0) + 1
}

/** The If-Match check of a write: 412 when the header names another version. */
function versionRefused(request: Request, entry: DnsEntry): Response | null {
  const ifMatch = request.headers.get('if-match')
  if (ifMatch === null || !entry.key) return null
  return ifMatch === dkimEtag(entry.name, entry.key) ? null : outdated()
}

interface ParsedKey {
  key?: KeyObject
  code?: 'invalidPrivateKey' | 'encryptedPrivateKey' | 'unsupportedKeyType' | 'keyLengthOutOfRange'
  params?: Record<string, unknown>
}

/** The private key rules of an import, decided by node:crypto (research R24). */
function parsePrivateKey(state: ScenarioState, text: string): ParsedKey {
  if (/-----BEGIN ENCRYPTED PRIVATE KEY-----|Proc-Type:\s*4,ENCRYPTED/.test(text)) {
    return { code: 'encryptedPrivateKey' }
  }
  let key: KeyObject
  try {
    key = createPrivateKey({ key: text, format: 'pem' })
  } catch (error) {
    const code = (error as { code?: string }).code ?? ''
    const passphrase = /PASSPHRASE|INTERRUPTED_OR_CANCELLED/.test(code)
    return { code: passphrase ? 'encryptedPrivateKey' : 'invalidPrivateKey' }
  }
  if (key.asymmetricKeyType !== 'rsa') {
    return { code: 'unsupportedKeyType', params: { allowed: ['rsa'] } }
  }
  const bits = key.asymmetricKeyDetails?.modulusLength ?? 0
  const { importKeyLengthMin: min, importKeyLengthMax: max } = state.dns.capabilities.dkim
  if (bits < min || bits > max) return { code: 'keyLengthOutOfRange', params: { min, max } }
  return { key }
}

const created = (name: string, etag: string) => ({
  headers: { Location: `/api/v2/dkim-keys/${encodeURIComponent(name)}`, ETag: etag },
})

export const dkimHandlers = [
  http.get('/capabilities/dns', ({ response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    return response(200).json({ data: capabilitiesFor(state, account) })
  }),

  http.get('/dkim-keys', ({ request, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const params = url.searchParams
    let items = dnsEntries(state, account).map(dkimKeyBody)
    const q = params.get('q')?.toLowerCase()
    if (q) {
      items = items.filter(
        (item) => item.name.toLowerCase().includes(q) || item.displayName.toLowerCase().includes(q),
      )
    }
    const states = params.getAll('state')
    if (states.length > 0) items = items.filter((item) => states.includes(item.state))
    const kind = params.get('kind')
    if (kind) items = items.filter((item) => item.kind === kind)
    const selector = params.get('selector')
    if (selector !== null) items = items.filter((item) => item.key?.selector === selector)
    const complete = params.get('complete')
    if (complete !== null) {
      items = items.filter(
        (item) => item.key !== null && item.key.complete === (complete === 'true'),
      )
    }
    const domain = params.get('domain')
    if (domain !== null) {
      const name = asciiName(domain) || domain.toLowerCase()
      items = items.filter((item) => item.name === name || item.targetDomain === name)
    }
    const sorted = sortEntries(items, params.get('sort') ?? 'name', params.get('order') === 'desc')
    return response(200).json(page(sorted, url))
  }),

  http.post('/dkim-keys', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    if (body.overwrite && account.role !== 'admin') {
      return response.untyped(problem(403, 'forbidden'))
    }
    const entry = findEntry(state, account, body.name)
    if (!entry || entry.kind === 'none') return response.untyped(notFound())
    const caps = state.dns.capabilities.dkim
    const errors: Violations = {}
    const selector = body.selector ?? caps.defaultSelector
    checkSelector(errors, state, selector)
    const keySize = body.keySize ?? caps.defaultKeySize
    if (!caps.allowedKeySizes.includes(keySize)) {
      addViolation(errors, 'keySize', 'notInList', { allowed: [...caps.allowedKeySizes] })
    }
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    const previous = entry.key
    if (previous && !body.overwrite) return response.untyped(problem(409, 'dkim-key-exists'))
    if (previous) {
      const stale = versionRefused(request, entry)
      if (stale) return response.untyped(stale)
    }
    const key = { ...mockDkimKey({ size: keySize, selector }), version: nextVersion(previous) }
    storeKey(state, entry.name, key)
    const data = changeResult(state, { ...entry, key }, 'generateDkimKey')
    if (previous) return response(200).json({ data }, { headers: { ETag: data.etag! } })
    return response(201).json({ data }, created(entry.name, data.etag!))
  }),

  http.post('/dkim-keys/bulk-actions', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const limit = state.dns.capabilities.dkim.bulkLimit
    if (body.targets.length > limit) {
      const errors: Violations = {}
      addViolation(errors, 'targets', 'tooMany', { max: limit })
      return response.untyped(validationFailed(errors))
    }
    const seen = new Set<string>()
    const results: BulkItemResult[] = []
    const publication: Record<string, DkimDnsPublicationOutcome> = {}
    const itemProblem = async (answer: Response) =>
      (await answer.json()) as BulkItemResult['problem']
    for (const target of body.targets) {
      const entry = findEntry(state, account, target.id)
      const id = entry?.name ?? target.id
      if (seen.has(id)) continue
      seen.add(id)
      if (!entry?.key) {
        results.push({ id: target.id, outcome: 'notFound' })
        continue
      }
      if (state.dns.failingBulkTargets?.includes(entry.name)) {
        const answer = problem(503, 'temporary-failure', {}, { 'Retry-After': '30' })
        results.push({ id: target.id, outcome: 'failed', problem: await itemProblem(answer) })
        continue
      }
      const current = dkimEtag(entry.name, entry.key)
      if (target.version !== undefined && target.version !== current) {
        results.push({
          id: target.id,
          outcome: 'outdated',
          version: current,
          problem: await itemProblem(outdated()),
        })
        continue
      }
      const selector = entry.key.selector
      delete state.dns.keys[entry.name]
      results.push({ id: target.id, outcome: 'done' })
      if (state.dns.capabilities.dkim.dnsPublicationEnabled) {
        publication[target.id] =
          state.dns.publication.applyDkimKeyBulkAction ??
          publicationOutcome('removed', { selector: selector ?? 'dkim' })
      }
    }
    const count = (outcome: BulkItemResult['outcome']) =>
      results.filter((item) => item.outcome === outcome).length
    const data = {
      bulkRequestId: Buffer.from(String(state.now())).toString('hex').padEnd(32, '0').slice(0, 32),
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
    if (!state.dns.capabilities.dkim.dnsPublicationEnabled) return response(200).json({ data })
    return response(200).json({ data, meta: { dnsPublication: publication } })
  }),

  http.get('/dkim-keys/{dkimName}', ({ params, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const entry = findEntry(state, account, pathName(params.dkimName))
    if (!entry) return response.untyped(notFound())
    const data = dkimKeyBody(entry)
    return response(200).json({ data }, data.etag ? { headers: { ETag: data.etag } } : undefined)
  }),

  http.delete('/dkim-keys/{dkimName}', ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const entry = findEntry(state, account, pathName(params.dkimName))
    if (!entry?.key) return response.untyped(notFound())
    const stale = versionRefused(request, entry)
    if (stale) return response.untyped(stale)
    delete state.dns.keys[entry.name]
    return response(204).empty()
  }),

  http.post('/dkim-keys/{dkimName}/import', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const raw = pathName(params.dkimName)
    const body = await request.json()
    const caps = state.dns.capabilities.dkim
    const errors: Violations = {}
    const ascii = asciiName(raw)
    if (!ascii || !isValidAsciiDomain(ascii)) {
      addViolation(errors, 'dkimName', 'invalidFormat', { format: 'domainName' })
    }
    let parsed: ParsedKey = {}
    // `privateKey` is write-only in the contract; the request carries it as a plain string.
    const text = body.privateKey as unknown as string
    if (utf8Bytes(text) > caps.privateKeyMaxBytes) {
      addViolation(errors, 'privateKey', 'tooLong', { max: caps.privateKeyMaxBytes, unit: 'bytes' })
    } else {
      parsed = parsePrivateKey(state, text)
      if (parsed.code) addViolation(errors, 'privateKey', parsed.code, parsed.params ?? {})
    }
    const selector = body.selector ?? caps.defaultSelector
    checkSelector(errors, state, selector)
    if (Object.keys(errors).length > 0 || !parsed.key) {
      return response.untyped(validationFailed(errors))
    }
    const entry: DnsEntry = findEntry(state, account, raw) ?? {
      name: ascii,
      displayName: ascii,
      kind: 'none',
      targetDomain: null,
      key: undefined,
    }
    const previous = entry.key
    if (previous && !body.overwrite) return response.untyped(problem(409, 'dkim-key-exists'))
    if (previous) {
      const stale = versionRefused(request, entry)
      if (stale) return response.untyped(stale)
    }
    const key: MockDkimKey = {
      selector,
      keyLength: parsed.key.asymmetricKeyDetails?.modulusLength ?? null,
      publicKey: createPublicKey(parsed.key)
        .export({ type: 'spki', format: 'der' })
        .toString('base64'),
      privateKeyPem: parsed.key.export({ type: 'pkcs8', format: 'pem' }).toString(),
      version: nextVersion(previous),
    }
    storeKey(state, entry.name, key)
    const stored = findEntry(state, account, entry.name) ?? { ...entry, key }
    const data = changeResult(state, stored, 'importDkimKey')
    if (previous) return response(200).json({ data }, { headers: { ETag: data.etag! } })
    return response(201).json({ data }, created(stored.name, data.etag!))
  }),

  http.post('/dkim-keys/{dkimName}/copy', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const source = findEntry(state, account, pathName(params.dkimName))
    if (!source?.key) return response.untyped(notFound())
    const sourceBody = dkimKeyBody(source)
    if (!sourceBody.key?.complete) return response.untyped(problem(409, null))
    const body = await request.json()
    const errors: Violations = {}
    const target = findEntry(state, account, body.target)
    const sameName =
      (asciiName(body.target) || body.target) === (asciiName(source.name) || source.name)
    if (sameName || target?.name === source.name) addViolation(errors, 'target', 'sameAsSource')
    else if (!target || target.kind === 'none') addViolation(errors, 'target', 'notFound')
    if (Object.keys(errors).length > 0 || !target) return response.untyped(validationFailed(errors))
    const previous = target.key
    if (previous && !body.overwrite) return response.untyped(problem(409, 'dkim-key-exists'))
    if (previous) {
      const stale = versionRefused(request, target)
      if (stale) return response.untyped(stale)
    }
    const key = { ...source.key, version: nextVersion(previous) }
    storeKey(state, target.name, key)
    const data = changeResult(state, { ...target, key }, 'copyDkimKey')
    if (previous) return response(200).json({ data }, { headers: { ETag: data.etag! } })
    return response(201).json({ data }, created(target.name, data.etag!))
  }),

  http.get('/dkim-keys/{dkimName}/private-key', ({ params, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    if (account.role !== 'admin') return response.untyped(problem(403, 'forbidden'))
    if (!state.dns.capabilities.dkim.privateKeyExportEnabled) {
      return response.untyped(problem(403, 'dkim-private-key-export-disabled'))
    }
    const entry = findEntry(state, account, pathName(params.dkimName))
    if (!entry?.key?.privateKeyPem) return response.untyped(notFound())
    return response(200).json(
      {
        data: {
          name: entry.name,
          selector: entry.key.selector ?? '',
          privateKey: entry.key.privateKeyPem,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }),

  http.post('/dkim-keys/{dkimName}/dns-publication', ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    if (account.role !== 'admin') return response.untyped(problem(403, 'forbidden'))
    if (!state.dns.capabilities.dkim.dnsPublicationEnabled) {
      return response.untyped(problem(403, 'dkim-dns-publication-disabled'))
    }
    const entry = findEntry(state, account, pathName(params.dkimName))
    if (!entry?.key || !dkimKeyBody(entry).key?.record) return response.untyped(notFound())
    const stale = versionRefused(request, entry)
    if (stale) return response.untyped(stale)
    const data = changeResult(state, entry, 'publishDkimDnsRecord')
    return response(200).json({ data }, { headers: { ETag: data.etag! } })
  }),
]
