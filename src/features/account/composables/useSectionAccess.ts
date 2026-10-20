// The access of the current section (UI 005 research R4, R5): in My account its `ownVisibility`
// (shown, replaced by the external notice, "no access", or the capabilities error), in the mailbox
// context its `mailboxAccess` (change, read-only with the missing flag, hidden). Pure rules from
// `../sections`, fed with the identity and the self-service capabilities.
import { computed } from 'vue'

import { useIdentityQuery } from '@/app/session/queries'

import { useSelfServiceCapabilities } from '@/shared/composables/useSelfServiceCapabilities'
import {
  mailboxAccess,
  ownVisibility,
  type AccountSectionId,
  type MailboxAccess,
  type OwnVisibility,
} from '../sections'
import { useAccountContext } from './useAccountContext'

export function useSectionAccess(id: () => AccountSectionId | null) {
  const identity = useIdentityQuery()
  const capabilities = useSelfServiceCapabilities()
  const context = useAccountContext()

  /** `pending` until the identity and the capabilities have answered (or failed). */
  const own = computed<OwnVisibility | 'pending'>(() => {
    const section = id()
    if (!section) return 'visible'
    if (!identity.data.value) return 'pending'
    if (capabilities.isPending.value) return 'pending'
    return ownVisibility(section, identity.data.value, capabilities.data.value)
  })

  const mailbox = computed<MailboxAccess>(() => {
    const section = id()
    return section ? mailboxAccess(section, identity.data.value) : { mode: 'change' }
  })

  /** Whether the section may change values (own context: visible; mailbox context: change). */
  const canChange = computed(() =>
    context.kind.value === 'own' ? own.value === 'visible' : mailbox.value.mode === 'change',
  )

  return { identity, capabilities, context, own, mailbox, canChange }
}
