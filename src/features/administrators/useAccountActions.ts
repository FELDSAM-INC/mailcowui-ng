import { useQueryClient } from '@tanstack/vue-query'
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { isApiProblem, problemOf, type ApiProblem, type AccountBulkActionRequest } from '@/api'
import { lt } from '@/i18n'
import { useConfirm } from '@/shared/composables/useConfirm'
import {
  deleteAccount,
  fetchAccount,
  suspendAccountSecondFactors,
  updateAccount,
  type AccountRole,
  type ManagedAccount,
} from './api'
import { confirmAccountChange, removalConfirmation, suspensionConfirmation } from './confirmations'
import { handleOwnAccountSave } from './own-account'
export function useAccountActions(options: {
  role: () => AccountRole
  allowed: () => boolean
  ownUsername: () => string
  activeAdminCount: () => number
  context: () => string
}) {
  const client = useQueryClient(),
    { t } = useI18n(),
    confirm = useConfirm()
  const pending = ref(false),
    problem = shallowRef<ApiProblem | null>(null),
    notice = ref<string | null>(null)
  async function run(
    action: AccountBulkActionRequest['action'],
    account: ManagedAccount,
  ): Promise<'done' | 'cancelled' | 'failed'> {
    if (pending.value || !options.allowed()) return 'cancelled'
    const role = options.role(),
      context = options.context(),
      own = role === 'admin' && account.username === options.ownUsername()
    if (action === 'delete' && own) {
      notice.value = lt('warning.cannot_delete_self')
      return 'cancelled'
    }
    if (
      role === 'admin' &&
      account.active &&
      options.activeAdminCount() <= 1 &&
      (action === 'deactivate' || action === 'delete')
    ) {
      notice.value = lt('warning.no_active_admin')
      return 'cancelled'
    }
    if (action === 'suspendSecondFactors' && account.secondFactorStatus !== 'active')
      return 'cancelled'
    if (action === 'delete' && !(await confirm(removalConfirmation(t, account)))) return 'cancelled'
    if (
      action === 'suspendSecondFactors' &&
      !(await confirm(suspensionConfirmation(t, account.username)))
    )
      return 'cancelled'
    if (
      action === 'deactivate' &&
      !(await confirmAccountChange(confirm, t, account, { active: false }, own))
    )
      return 'cancelled'
    if (pending.value || !options.allowed() || context !== options.context()) return 'cancelled'
    pending.value = true
    problem.value = null
    notice.value = null
    try {
      let current = account
      if (action === 'delete') {
        for (;;) {
          try {
            await deleteAccount(client, role, current.username, current.etag)
            break
          } catch (error) {
            if (!isApiProblem(error) || error.status !== 412) throw error
            current = await fetchAccount(role, current.username)
            if (
              !(await confirm(removalConfirmation(t, current))) ||
              !options.allowed() ||
              context !== options.context()
            )
              return 'cancelled'
          }
        }
        notice.value =
          role === 'admin'
            ? lt('success.admin_removed', account.username)
            : lt('success.domain_admin_removed', account.username)
      } else if (action === 'suspendSecondFactors') {
        await suspendAccountSecondFactors(client, role, current.username, current.etag)
        notice.value =
          role === 'admin'
            ? lt('success.admin_modified')
            : lt('success.domain_admin_modified', current.username)
      } else {
        const saved = await updateAccount(
          client,
          role,
          current.username,
          { active: action === 'activate' },
          current.etag,
        )
        if (own) await handleOwnAccountSave(current, saved, options.ownUsername())
        notice.value =
          role === 'admin'
            ? lt('success.admin_modified')
            : lt('success.domain_admin_modified', current.username)
      }
      return 'done'
    } catch (error) {
      problem.value = problemOf(error)
      return 'failed'
    } finally {
      pending.value = false
    }
  }
  return { pending, problem, notice, run }
}
