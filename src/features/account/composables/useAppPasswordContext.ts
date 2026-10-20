import { computed } from 'vue'
import { useSectionAccess } from './useSectionAccess'
export function useAppPasswordContext() {
  const access = useSectionAccess(() => 'appPasswords')
  const mailbox = access.context.mailbox
  const mailboxContext = computed(() => access.context.kind.value === 'mailbox')
  function location(kind: 'list' | 'create' | 'detail', id?: number) {
    const suffix = kind === 'list' ? 'app-passwords' : `app-password-${kind}`
    return {
      name: `${mailboxContext.value ? 'mailbox' : 'account'}-${suffix}`,
      params: {
        ...(mailboxContext.value ? { address: mailbox.value } : {}),
        ...(id === undefined ? {} : { appPasswordId: id }),
      },
    }
  }
  return { access, mailbox, mailboxContext, location }
}
