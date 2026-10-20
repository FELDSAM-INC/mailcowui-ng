import type { ComposerTranslation } from 'vue-i18n'
import { lt } from '@/i18n'
import type { ConfirmRequest } from '@/shared/composables/useConfirm'
import type { AccountPatch, ManagedAccount } from './api'
export async function confirmAccountChange(
  confirm: (request: ConfirmRequest) => Promise<boolean>,
  t: ComposerTranslation,
  account: ManagedAccount,
  patch: AccountPatch,
  own: boolean,
): Promise<boolean> {
  if (
    patch.username &&
    patch.username !== account.username &&
    !(await confirm({
      title: t('accounts.confirm.renameTitle'),
      description: t(own ? 'accounts.confirm.renameOwn' : 'accounts.confirm.rename', {
        username: account.username,
        next: patch.username,
      }),
      confirmLabel: lt('edit.save'),
    }))
  )
    return false
  if (
    patch.active === false &&
    account.active &&
    !(await confirm({
      title: lt('mailbox.deactivate'),
      description: t(own ? 'accounts.confirm.deactivateOwn' : 'accounts.confirm.deactivate', {
        username: account.username,
      }),
      confirmLabel: lt('mailbox.deactivate'),
      destructive: true,
    }))
  )
    return false
  return true
}
export function removalConfirmation(
  t: ComposerTranslation,
  account: ManagedAccount,
): ConfirmRequest {
  return {
    title: lt('footer.confirm_delete'),
    description: t(
      'domains' in account ? 'accounts.confirm.removeDomainAdmin' : 'accounts.confirm.removeAdmin',
      {
        username: account.username,
        domains:
          'domains' in account
            ? account.domains.map((domain) => domain.domainUnicode).join(', ')
            : '',
      },
    ),
    confirmLabel: lt('footer.delete_now'),
    destructive: true,
  }
}
export function suspensionConfirmation(t: ComposerTranslation, username: string): ConfirmRequest {
  return {
    title: lt('tfa.disable_tfa'),
    description: t('accounts.confirm.suspend', { username }),
    confirmLabel: lt('tfa.disable_tfa'),
    destructive: true,
  }
}
