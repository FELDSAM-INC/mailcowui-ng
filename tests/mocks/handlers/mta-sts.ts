// MTA-STS handlers (UI 010 T007, T064): the policies of the domains in the caller's scope, with
// API 010's rules and codes. A change of the version, mode, MX hosts (or their order) or max age
// gives a new policy identifier; an active-only or empty change keeps it. Alias domains have no
// policy of their own (404).
import type { MtaStsMode, MtaStsPolicy } from '@/api'

import { asciiName } from '../factories/domain'
import { nextPolicyId, policyBody, policyEtag } from '../factories/mta-sts-policy'
import type { MockMtaStsPolicy, ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, scenario } from './context'
import {
  addViolation,
  compareValues,
  findInScope,
  isValidAsciiDomain,
  notFound,
  outdated,
  page,
  requireManager,
  scopeOf,
  validationFailed,
  type Violations,
} from './domain-rules'

interface PolicyInput {
  version?: string
  mode?: string
  maxAge?: number
  mxHosts?: string[]
}

/** One MX host in stored form, or null when it is not a valid name (`*.` allowed). */
function mxHost(raw: string): string | null {
  const value = raw.trim().toLowerCase().replace(/\.$/, '')
  const wildcard = value.startsWith('*.')
  const ascii = asciiName(wildcard ? value.slice(2) : value)
  if (!ascii || !isValidAsciiDomain(ascii)) return null
  return wildcard ? `*.${ascii}` : ascii
}

/** The rules of API 010 on the members sent; the normalised values. */
function checkInput(
  state: ScenarioState,
  body: PolicyInput,
  errors: Violations,
  required: boolean,
): { mode?: MtaStsMode; maxAge?: number; mxHosts?: string[] } {
  const caps = state.dns.capabilities.mtaSts
  const result: { mode?: MtaStsMode; maxAge?: number; mxHosts?: string[] } = {}
  if (body.version !== undefined && body.version.toLowerCase() !== 'stsv1') {
    addViolation(errors, 'version', 'notInList', { allowed: ['STSv1'] })
  }
  if (body.mode === undefined || body.mode === '') {
    if (required || body.mode === '') addViolation(errors, 'mode', 'required')
  } else {
    const mode = body.mode.toLowerCase() as MtaStsMode
    if (caps.modes.includes(mode)) result.mode = mode
    else addViolation(errors, 'mode', 'notInList', { allowed: [...caps.modes] })
  }
  if (body.maxAge === undefined) {
    if (required) addViolation(errors, 'maxAge', 'required')
  } else if (
    !Number.isInteger(body.maxAge) ||
    body.maxAge < caps.maxAgeMin ||
    body.maxAge > caps.maxAgeMax
  ) {
    addViolation(errors, 'maxAge', 'outOfRange', { min: caps.maxAgeMin, max: caps.maxAgeMax })
  } else result.maxAge = body.maxAge
  if (body.mxHosts !== undefined || required) {
    const hosts = body.mxHosts ?? []
    if (hosts.length === 0) addViolation(errors, 'mxHosts', 'required')
    const stored: string[] = []
    hosts.forEach((raw, index) => {
      const host = mxHost(raw)
      if (host === null)
        addViolation(errors, `mxHosts.${index}`, 'invalidFormat', { format: 'mxHost' })
      else if (!stored.includes(host)) stored.push(host)
    })
    if (stored.join(',').length > caps.mxMaxLength) {
      addViolation(errors, 'mxHosts', 'tooLong', { max: caps.mxMaxLength })
    }
    result.mxHosts = stored
  }
  return result
}

const SORT_VALUE: Record<string, (policy: MtaStsPolicy) => string | number> = {
  domain: (policy) => policy.domain,
  mode: (policy) => policy.mode,
  maxAge: (policy) => policy.maxAge,
  policyId: (policy) => policy.policyId,
}

function policyOf(state: ScenarioState, domain: string): MockMtaStsPolicy | undefined {
  return state.dns.policies[domain]
}

export const mtaStsHandlers = [
  http.get('/mta-sts-policies', ({ request, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const params = url.searchParams
    let items = scopeOf(state, account)
      .filter((domain) => policyOf(state, domain.name))
      .map((domain) => policyBody(state, domain.name, policyOf(state, domain.name)!))
    const q = params.get('q')?.toLowerCase()
    if (q) {
      items = items.filter(
        (item) => item.domain.includes(q) || item.displayDomain.toLowerCase().includes(q),
      )
    }
    const active = params.get('active')
    if (active !== null) items = items.filter((item) => item.active === (active === 'true'))
    const mode = params.get('mode')
    if (mode) items = items.filter((item) => item.mode === mode)
    const value = SORT_VALUE[params.get('sort') ?? 'domain'] ?? SORT_VALUE.domain!
    const direction = params.get('order') === 'desc' ? -1 : 1
    items.sort(
      (a, b) => direction * compareValues(value(a), value(b)) || a.domain.localeCompare(b.domain),
    )
    return response(200).json(page(items, url))
  }),

  http.post('/mta-sts-policies', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const domain = findInScope(state, account, body.domain)
    if (!domain) return response.untyped(notFound())
    const errors: Violations = {}
    const values = checkInput(state, body, errors, true)
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    if (policyOf(state, domain.name)) return response.untyped(problem(409, 'mta-sts-policy-exists'))
    const policy: MockMtaStsPolicy = {
      mode: values.mode!,
      mxHosts: values.mxHosts!,
      maxAge: values.maxAge!,
      active: body.active ?? false,
      policyId: nextPolicyId(state),
      version: 1,
    }
    state.dns.policies[domain.name] = policy
    const data = policyBody(state, domain.name, policy)
    return response(201).json(
      { data },
      { headers: { Location: `/api/v2/mta-sts-policies/${domain.name}`, ETag: data.etag } },
    )
  }),

  http.get('/mta-sts-policies/{policyDomain}', ({ params, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const domain = findInScope(state, account, params.policyDomain)
    const policy = domain && policyOf(state, domain.name)
    if (!domain || !policy) return response.untyped(notFound())
    const data = policyBody(state, domain.name, policy)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.patch('/mta-sts-policies/{policyDomain}', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const domain = findInScope(state, account, params.policyDomain)
    const policy = domain && policyOf(state, domain.name)
    if (!domain || !policy) return response.untyped(notFound())
    const ifMatch = request.headers.get('if-match')
    if (ifMatch !== null && ifMatch !== policyEtag(domain.name, policy)) {
      return response.untyped(outdated())
    }
    const body = await request.json()
    const errors: Violations = {}
    const values = checkInput(state, body, errors, false)
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    const identifying =
      (values.mode !== undefined && values.mode !== policy.mode) ||
      (values.maxAge !== undefined && values.maxAge !== policy.maxAge) ||
      (values.mxHosts !== undefined && values.mxHosts.join(',') !== policy.mxHosts.join(','))
    const activeChanged = body.active !== undefined && body.active !== policy.active
    if (identifying || activeChanged) {
      Object.assign(policy, {
        mode: values.mode ?? policy.mode,
        maxAge: values.maxAge ?? policy.maxAge,
        mxHosts: values.mxHosts ?? policy.mxHosts,
        active: body.active ?? policy.active,
        version: policy.version + 1,
      })
      if (identifying) policy.policyId = nextPolicyId(state)
    }
    const data = policyBody(state, domain.name, policy)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
]
