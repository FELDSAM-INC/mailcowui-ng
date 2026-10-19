// UI 006 (T025): `getQuarantineCapabilities` with the server defaults the spec names (bulk limit
// 100, page sizes 25 and 1000, a content limit of 10 MiB, scores 0-5000 in steps of 0.1, patterns of
// 100 characters from `a-z0-9@_.*-`, rate limits 1-2147483647 per second, minute, hour or day, the
// settings limits, and virus scanning on). Scenarios lower single values, for example the bulk limit.
import type { QuarantineCapabilities } from '@/api'

import type { QuarantinePatch } from '../scenarios/state'

export const MIB = 1_048_576

export function defaultQuarantineCapabilities(): QuarantineCapabilities {
  return {
    bulkLimit: 100,
    defaultPageSize: 25,
    maxPageSize: 1000,
    contentSizeLimit: 10 * MIB,
    pipelineMaxMessageSize: 10 * MIB,
    spamScore: { min: 0, max: 5000, step: 0.1 },
    senderPattern: { maxLength: 100, allowedCharacters: 'a-z0-9@_.*-', wildcard: '*' },
    rateLimit: { min: 1, max: 2147483647, frames: ['second', 'minute', 'hour', 'day'] },
    settings: {
      maxRetentionPerMailbox: 2147483647,
      maxMessageSizeStep: MIB,
      maxMessageSize: 2251799812636672,
      maxAgeDays: { min: 1, max: 2147483647, default: 365 },
      notificationSubjectMaxLength: 255,
      notificationTemplateMaxBytes: MIB,
      templateRenderTimeoutSeconds: 10,
      releaseFormats: ['original', 'attachment'],
    },
    virusScanning: true,
  }
}

/** The capabilities with a patch's values merged in (`settings` merged member by member). */
export function mergeCapabilities(
  current: QuarantineCapabilities,
  patch: NonNullable<QuarantinePatch['capabilities']>,
): QuarantineCapabilities {
  const { settings, ...rest } = patch
  return {
    ...current,
    ...rest,
    settings: { ...current.settings, ...settings },
  }
}
