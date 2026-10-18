// What the session lifecycle acts on: the query cache, the router and the cross-tab channel. The
// app installs one context at start (src/app/session/index.ts); tests pass their own.
import type { QueryClient } from '@tanstack/vue-query'
import type { Router } from 'vue-router'

import type { AppChannel } from '@/shared/platform/broadcast'

export interface SessionContext {
  queryClient: QueryClient
  router: Router
  channel: AppChannel
}

let active: SessionContext | null = null

export function setSessionContext(context: SessionContext | null): void {
  active = context
}

export function sessionContext(): SessionContext {
  if (!active) throw new Error('The session context is not installed')
  return active
}
