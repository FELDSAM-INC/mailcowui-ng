import { createOAuthReturnCapture } from '@/shared/platform/oauth-return'
const capture = createOAuthReturnCapture(/^\/(?:ng\/)?sync-sources\/oauth\/return\/?$/i)
export const captureSyncSourceReturn = capture.capture
export const takeSyncSourceReturn = capture.take
