// The sections My account offers (UI 005 research R4): registered routes the account may open, in
// the classic user page's order. Hidden sections are left out; replaced and unknown ones stay
// (their pages explain).
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useIdentityQuery } from '@/app/session/queries'

import { useSelfServiceCapabilities } from '@/shared/composables/useSelfServiceCapabilities'
import { ACCOUNT_SECTIONS, ownVisibility } from '../sections'

export function useOfferedSections() {
  const router = useRouter()
  const identity = useIdentityQuery()
  const capabilities = useSelfServiceCapabilities()
  return computed(() =>
    ACCOUNT_SECTIONS.filter(
      (item) =>
        item.route !== null &&
        router.hasRoute(item.route) &&
        ownVisibility(item.id, identity.data.value, capabilities.data.value) !== 'hidden',
    ),
  )
}
