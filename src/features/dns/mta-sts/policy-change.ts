// MTA-STS changes (FR-047 to FR-050 as settled): the form values of a policy or of a new one (the
// classic form starts with "enforce", an empty max age, the server's host name as the MX host and
// the policy inactive), the merge patch with only the changed members, and the changes the API
// reports back: a renewed identifier (never guessed from the fields) and an activation.
import type { DnsCapabilities, MtaStsPolicy, MtaStsPolicyPatch } from '@/api'

import { formatMxHosts, mxAscii } from './mx-hosts'

export interface MtaStsFormValues {
  version: string
  mode: string
  /** Seconds, as typed. */
  maxAge: string
  /** The comma-separated MX hosts, as typed. */
  mx: string
  active: boolean
}

/** The checked values of a form, ready to send. */
export interface MtaStsValues {
  mode: string
  maxAge: number
  mxHosts: string[]
  active: boolean
}

export function newPolicyForm(caps: DnsCapabilities): MtaStsFormValues {
  return {
    version: caps.mtaSts.version,
    mode: caps.mtaSts.modes[0] ?? 'enforce',
    maxAge: '',
    mx: caps.serverHostname,
    active: caps.mtaSts.defaultActive,
  }
}

export function formFromPolicy(policy: MtaStsPolicy): MtaStsFormValues {
  return {
    version: policy.version,
    mode: policy.mode,
    maxAge: String(policy.maxAge),
    mx: formatMxHosts(policy.mxHosts),
    active: policy.active,
  }
}

const asciiList = (hosts: readonly string[]) =>
  hosts.map((host) => mxAscii(host) ?? host.toLowerCase()).join(',')

/** Only the members that differ from the policy as read (FR-049). */
export function policyPatch(base: MtaStsPolicy, values: MtaStsValues): MtaStsPolicyPatch {
  const patch: MtaStsPolicyPatch = {}
  if (values.mode !== base.mode) patch.mode = values.mode
  if (values.maxAge !== base.maxAge) patch.maxAge = values.maxAge
  if (asciiList(values.mxHosts) !== asciiList(base.mxHosts)) patch.mxHosts = [...values.mxHosts]
  if (values.active !== base.active) patch.active = values.active
  return patch
}

/** The API renewed the policy identifier with this save (FR-050). */
export function policyIdChanged(before: MtaStsPolicy | null, after: MtaStsPolicy): boolean {
  return before !== null && before.policyId !== after.policyId
}

export function activationChange(
  before: MtaStsPolicy | null,
  after: MtaStsPolicy,
): 'activated' | 'deactivated' | null {
  const was = before?.active ?? false
  if (!was && after.active) return 'activated'
  if (was && !after.active) return 'deactivated'
  return null
}
