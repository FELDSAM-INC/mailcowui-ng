// The signed-in user's role for the DNS screens (FR-002): from the identity, which the shell keeps.
import { computed } from 'vue'

import type { Role } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'

export function useDnsRole() {
  const identity = useIdentityQuery()
  return {
    identity,
    role: computed<Role | undefined>(() => identity.data.value?.role),
  }
}
