// Which mailbox a self-service section works on (UI 005 research R3, R5): `own` in My account (the
// signed-in username, the mailbox of a mailbox user) or `mailbox` in the mailbox context (the
// route's `:address`, lower-cased). One section implementation serves both.
import { computed, type ComputedRef } from 'vue'
import { useRoute } from 'vue-router'

import { useIdentityQuery } from '@/app/session/queries'

export type AccountContextKind = 'own' | 'mailbox'

export interface AccountContext {
  kind: ComputedRef<AccountContextKind>
  /** The mailbox address the section reads and changes; empty until the identity is known. */
  mailbox: ComputedRef<string>
}

export function useAccountContext(): AccountContext {
  const route = useRoute()
  const identity = useIdentityQuery()
  const kind = computed<AccountContextKind>(() =>
    typeof route.params.address === 'string' ? 'mailbox' : 'own',
  )
  const mailbox = computed(() => {
    const address = route.params.address
    if (typeof address === 'string') return address.toLowerCase()
    return identity.data.value?.username.toLowerCase() ?? ''
  })
  return { kind, mailbox }
}
