// Capture before bootstrap. Existing /ng/ registrations also work with root routing.
import { createOAuthReturnCapture } from '@/shared/platform/oauth-return'
export type { CapturedOAuthReturn as CapturedReturn } from '@/shared/platform/oauth-return'
export const SSO_RETURN_PATH = `${import.meta.env.BASE_URL}sso/return`
const capture = createOAuthReturnCapture(/^\/(?:ng\/)?sso\/return\/?$/i)
export const captureSingleSignOnReturn = capture.capture
export const takeCapturedSingleSignOnReturn = capture.take
