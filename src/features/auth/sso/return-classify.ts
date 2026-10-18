// What the return page does with the captured parameters (UI 012 data-model §2, research R6). The
// limits come from the contract: a code of 1 to 4,096 and a state of 1 to 512 characters, and the
// OAuth error code pattern. Values outside them would only earn a 422, so the pending sign-in is
// cancelled instead.
import {
  OAUTH_ERROR_CODE_PATTERN,
  SSO_CODE_MAX_LENGTH,
  SSO_STATE_MAX_LENGTH,
} from '@/shared/validation/limits'

import type { CapturedReturn } from './capture'

export type ReturnClassification =
  | { kind: 'complete'; code: string; state: string }
  | { kind: 'providerError'; error: string; state: string }
  | { kind: 'providerErrorUnreportable' }
  | { kind: 'malformed' }
  | { kind: 'empty' }

const fits = (value: string, max: number) => value.length >= 1 && value.length <= max

export function classifyReturn(captured: CapturedReturn | null): ReturnClassification {
  if (!captured) return { kind: 'empty' }
  const { code, state, error } = captured
  if (error !== undefined) {
    return state !== undefined &&
      fits(state, SSO_STATE_MAX_LENGTH) &&
      OAUTH_ERROR_CODE_PATTERN.test(error)
      ? { kind: 'providerError', error, state }
      : { kind: 'providerErrorUnreportable' }
  }
  if (code !== undefined && state !== undefined) {
    return fits(code, SSO_CODE_MAX_LENGTH) && fits(state, SSO_STATE_MAX_LENGTH)
      ? { kind: 'complete', code, state }
      : { kind: 'malformed' }
  }
  if (code !== undefined || state !== undefined) return { kind: 'malformed' }
  return { kind: 'empty' }
}
