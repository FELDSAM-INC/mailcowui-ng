import { computed } from 'vue'
import { useSectionAccess } from './useSectionAccess'

export function useTemporaryAliasContext() {
  const access = useSectionAccess(() => 'temporaryAliases')
  const mailbox = access.context.mailbox
  const mailboxContext = computed(() => access.context.kind.value === 'mailbox')
  function location(kind: 'list' | 'create') {
    return {
      name: `${mailboxContext.value ? 'mailbox' : 'account'}-${kind === 'list' ? 'temporary-aliases' : 'temporary-alias-create'}`,
      params: mailboxContext.value ? { address: mailbox.value } : {},
    }
  }
  return { access, mailbox, location }
}
