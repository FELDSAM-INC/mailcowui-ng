// The outcome of adding a forwarding host, handed from the add page to the list (research R17):
// a one-shot value in memory, read once and cleared; never in history state or storage, so a
// reload drops it while the list, filtered by the source, still shows the addresses.
import { shallowRef } from 'vue'

import type { ForwardingHostCreationResult } from '@/api'

const pending = shallowRef<ForwardingHostCreationResult | null>(null)

export function useForwardingHostResults() {
  return {
    /** Keeps a result for the next list view. */
    hand(result: ForwardingHostCreationResult) {
      pending.value = result
    },
    /** Takes the result once, for the source it was made for. */
    take(source: string | undefined): ForwardingHostCreationResult | null {
      const result = pending.value
      pending.value = null
      return result && result.source === source ? result : null
    },
  }
}
