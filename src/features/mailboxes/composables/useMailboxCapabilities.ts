// The mailbox capabilities (research R16): limits and server settings of every form, the list and
// the dialogs, never hard-coded. Cached for 5 minutes.
import { useQuery } from '@tanstack/vue-query'

import { capabilitiesOptions } from '../api'

export function useMailboxCapabilities() {
  return useQuery(capabilitiesOptions())
}
