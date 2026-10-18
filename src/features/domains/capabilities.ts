// The domain capabilities (UI 002 research D6): limits and server settings of every form and the
// list, never hard-coded (conventions "Where features meet"). Cached for 5 minutes.
import { useQuery } from '@tanstack/vue-query'

import { capabilitiesOptions } from './api'

export function useDomainCapabilities() {
  return useQuery(capabilitiesOptions())
}
