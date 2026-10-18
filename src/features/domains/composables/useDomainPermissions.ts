// The signed-in user's permission matrix for domains (FR-002, research D24).
import { computed } from 'vue'

import { useIdentityQuery } from '@/app/session/queries'

import { domainPermissions } from '../permissions'

export function useDomainPermissions() {
  const identity = useIdentityQuery()
  return {
    identity,
    permissions: computed(() => domainPermissions(identity.data.value)),
  }
}
