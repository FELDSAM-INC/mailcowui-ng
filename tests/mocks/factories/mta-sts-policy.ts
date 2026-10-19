// MTA-STS policy factory (UI 010 T005): stored policies and the contract `MtaStsPolicy`. The
// policy identifier is a `YYYYMMDDhhmmss` timestamp of the scenario clock, always greater than
// the previous one handed out in the scenario, as API 010 guarantees.
import { createHash } from 'node:crypto'

import type { MtaStsMode, MtaStsPolicy } from '@/api'

import type { MockMtaStsPolicy, ScenarioState } from '../scenarios/state'
import { readableName } from './domain'

function stamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:T]/g, '').slice(0, 14)
}

/** A new policy identifier: the scenario time, or one second after the previous identifier. */
export function nextPolicyId(state: ScenarioState): string {
  let id = stamp(state.now())
  const last = state.dns.lastPolicyId
  if (last && id <= last) {
    const year = Number(last.slice(0, 4))
    const month = Number(last.slice(4, 6)) - 1
    const day = Number(last.slice(6, 8))
    const hour = Number(last.slice(8, 10))
    const minute = Number(last.slice(10, 12))
    const second = Number(last.slice(12, 14))
    id = stamp(Date.UTC(year, month, day, hour, minute, second) + 1000)
  }
  state.dns.lastPolicyId = id
  return id
}

/** A stored policy with a fresh identifier. */
export function mockPolicy(
  state: ScenarioState,
  values: { mode?: MtaStsMode; mxHosts?: string[]; maxAge?: number; active?: boolean } = {},
): MockMtaStsPolicy {
  return {
    mode: values.mode ?? 'enforce',
    mxHosts: values.mxHosts ?? [state.serverHostname],
    maxAge: values.maxAge ?? 604_800,
    active: values.active ?? false,
    policyId: nextPolicyId(state),
    version: 1,
  }
}

export function policyEtag(domain: string, policy: MockMtaStsPolicy): string {
  const hash = createHash('sha256')
    .update(
      JSON.stringify([
        domain,
        policy.mode,
        policy.mxHosts,
        policy.maxAge,
        policy.active,
        policy.policyId,
        policy.version,
      ]),
    )
    .digest('hex')
    .slice(0, 24)
  return `"${hash}"`
}

/** The policy text the publication endpoint serves. */
export function policyText(policy: MockMtaStsPolicy): string {
  const mx = policy.mxHosts.map((host) => `mx: ${host}\n`).join('')
  return `version: STSv1\nmode: ${policy.mode}\n${mx}max_age: ${policy.maxAge}\n`
}

/** The contract `MtaStsPolicy` of a stored policy. */
export function policyBody(
  state: ScenarioState,
  domain: string,
  policy: MockMtaStsPolicy,
): MtaStsPolicy {
  return {
    domain,
    displayDomain: readableName(domain),
    version: 'STSv1',
    mode: policy.mode,
    mxHosts: [...policy.mxHosts],
    maxAge: policy.maxAge,
    active: policy.active,
    policyId: policy.policyId,
    policyUrl: `https://mta-sts.${domain}/.well-known/mta-sts.txt`,
    policyText: policyText(policy),
    dnsRecords: [
      { name: `_mta-sts.${domain}`, type: 'TXT', value: `v=STSv1;id=${policy.policyId};` },
      { name: `mta-sts.${domain}`, type: 'CNAME', value: state.serverHostname },
    ],
    etag: policyEtag(domain, policy),
  }
}
