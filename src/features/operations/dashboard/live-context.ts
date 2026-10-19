// The dashboard's live-update controller, provided to the container cards, so that an expanded
// card polls its resource usage at the same interval and stops with the rest.
import { inject, type InjectionKey } from 'vue'

import type { LiveKind } from '../capabilities'

export interface LiveContext {
  interval(kind: LiveKind): number | false
}

export const LIVE_CONTEXT: InjectionKey<LiveContext> = Symbol('operations-live')

/** The provided controller; without one (a component test) nothing polls. */
export function useLiveContext(): LiveContext {
  return inject(LIVE_CONTEXT, { interval: () => false })
}
