// Publication outcome factory (UI 010 T005): the outcome of the FeldHost DKIM DNS publication for
// every status, and `failed` with every reason code, with and without a technical detail.
import {
  dkimDnsPublicationReasonCodeValues,
  dkimDnsPublicationStatusValues,
  type DkimDnsPublicationOutcome,
  type DkimDnsPublicationReasonCode,
  type DkimDnsPublicationStatus,
} from '@/api'

/** The outcome of a status for the record `<selector>._domainkey`. */
export function publicationOutcome(
  status: DkimDnsPublicationStatus,
  options: {
    selector?: string
    reason?: DkimDnsPublicationReasonCode
    detail?: string | null
  } = {},
): DkimDnsPublicationOutcome {
  if (status === 'notConfigured') return { status, recordName: null, reason: null }
  const recordName = `${options.selector ?? 'dkim'}._domainkey`
  if (status !== 'failed') return { status, recordName, reason: null }
  return {
    status,
    recordName,
    reason: { code: options.reason ?? 'unreachable', detail: options.detail ?? null },
  }
}

/** Every status once (failed with its first reason code). */
export function everyPublicationStatus(selector = 'dkim'): DkimDnsPublicationOutcome[] {
  return dkimDnsPublicationStatusValues.map((status) => publicationOutcome(status, { selector }))
}

/** `failed` with every reason code, with and without a detail. */
export function everyFailedOutcome(selector = 'dkim'): DkimDnsPublicationOutcome[] {
  return dkimDnsPublicationReasonCodeValues.flatMap((reason) => [
    publicationOutcome('failed', { selector, reason }),
    publicationOutcome('failed', {
      selector,
      reason,
      detail: `ISPConfig fault: ${reason} (soap:Server)`,
    }),
  ])
}
