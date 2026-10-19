// The signed-in identity and the routing permissions derived from it (data-model §2): the role
// and the flags `bccMaps`, `domainRelayhost` and `mailboxRelayhost`, as `GET /me` reports them.
import { computed } from 'vue'

import { useIdentityQuery } from '@/app/session/queries'

import { canSeeHistory, canWriteBccMaps, canWriteRouting, openScreens } from '../access'

export function useRoutingIdentity() {
  const query = useIdentityQuery()
  const identity = computed(() => query.data.value ?? null)
  return {
    identity,
    isAdmin: computed(() => identity.value?.role === 'admin'),
    canWrite: computed(() => canWriteRouting(identity.value)),
    canWriteBcc: computed(() => canWriteBccMaps(identity.value)),
    canSeeHistory: computed(() => canSeeHistory(identity.value)),
    screens: computed(() => openScreens(identity.value)),
  }
}
