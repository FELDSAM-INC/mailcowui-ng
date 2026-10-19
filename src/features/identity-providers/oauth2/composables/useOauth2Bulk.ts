// The classic quick actions of selected OAuth2 clients (FR-065, `tab-config-oauth2.twig`):
// "Remove", "Revoke all client tokens" and "Generate new client secret" (gap G42), each one request
// of the API's bulk operation with the clients' version tags as listed. A deletion needs the
// number of clients typed; the other two one confirmation. The result has one row per client;
// failed, refused and outdated clients stay selected for a retry with the refreshed list's version
// tags, which repeats the confirmed action without asking again. A lost connection reports every
// client as "outcome unknown", clears the selection and retries nothing. The new secrets of a
// renewal are queued for the one-time secret dialog, one client after another, and live only here.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt, type LegacyKey } from '@/i18n'
import {
  problemOf,
  queryKeys,
  reportSessionProblem,
  type ApiProblem,
  type Oauth2Client,
} from '@/api'
import { isRetryable, type BulkRow } from '@/shared/components/bulk-row'
import { announce } from '@/shared/composables/useAnnouncer'
import type { BulkSelection } from '@/shared/composables/useBulkSelection'
import { confirm } from '@/shared/composables/useConfirm'

import { bulkOauth2Clients } from '../api'
import {
  newSecretsOf,
  rowsFromOauth2BulkResult,
  toBulkTargets,
  unknownRows,
  type NewSecret,
} from '../bulk'
import ClientIdList from '../components/ClientIdList.vue'

export type Oauth2BulkAction = 'delete' | 'revokeTokens' | 'renewSecret'

/** The classic quick action labels (`tab-config-oauth2.twig`). */
export const BULK_LABELS: Record<Oauth2BulkAction, LegacyKey> = {
  delete: 'mailbox.remove',
  revokeTokens: 'admin.oauth2_revoke_tokens',
  renewSecret: 'admin.oauth2_renew_secret',
}

export function useOauth2Bulk(options: {
  selection: BulkSelection
  entries: () => readonly Oauth2Client[]
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const phase = ref<'idle' | 'running' | 'results'>('idle')
  const rows = shallowRef<BulkRow[]>([])
  const running = ref(0)
  const problem = shallowRef<ApiProblem | null>(null)
  const secrets = shallowRef<NewSecret[]>([])
  let confirmed: Oauth2BulkAction | null = null

  function selected(): Oauth2Client[] {
    const ids = options.selection.ids.value
    return options.entries().filter((entry) => ids.has(String(entry.id)))
  }

  function ask(action: Oauth2BulkAction, clients: readonly Oauth2Client[]): Promise<boolean> {
    const content = {
      component: ClientIdList,
      props: { clientIds: clients.map((client) => client.clientId) },
    }
    if (action === 'delete') {
      return confirm({
        title: lt('footer.confirm_delete'),
        description: lt('footer.delete_these_items'),
        content,
        confirmLabel: lt('footer.delete_now'),
        cancelLabel: lt('footer.cancel'),
        destructive: true,
        requireTyped: {
          accepted: [String(clients.length)],
          labelKey: 'bulk.confirm.typeCount',
          labelParams: { count: clients.length },
        },
      })
    }
    return confirm({
      title: lt(BULK_LABELS[action]),
      description: lt('footer.delete_these_items'),
      content,
      confirmLabel: lt(BULK_LABELS[action]),
      cancelLabel: lt('footer.cancel'),
      destructive: true,
    })
  }

  async function run(action: Oauth2BulkAction, retrying = false) {
    if (phase.value === 'running') return
    if (retrying) {
      await queryClient.refetchQueries(
        { queryKey: queryKeys.oauth2Clients.lists(), type: 'active' },
        { cancelRefetch: false },
      )
    }
    const clients = selected()
    if (clients.length === 0) return
    if (!retrying && !(await ask(action, clients))) return
    confirmed = action
    phase.value = 'running'
    running.value = clients.length
    problem.value = null
    announce(t('bulk.progress', { count: clients.length }))
    try {
      const result = await bulkOauth2Clients(queryClient, {
        action,
        targets: toBulkTargets(clients),
      })
      rows.value = rowsFromOauth2BulkResult(result, clients)
      secrets.value = action === 'renewSecret' ? newSecretsOf(result, clients) : []
      options.selection.keep(rows.value.filter(isRetryable).map((row) => row.id))
    } catch (error) {
      const failure = problemOf(error)!
      reportSessionProblem(failure)
      if (failure.kind === 'network') {
        rows.value = unknownRows(clients)
        options.selection.clear()
      } else {
        rows.value = []
        problem.value = failure
      }
    } finally {
      running.value = 0
    }
    phase.value = 'results'
  }

  return {
    phase,
    rows,
    running,
    problem,
    /** The client whose new secret the one-time dialog shows, or null. */
    secret: computed(() => secrets.value[0] ?? null),
    run: (action: Oauth2BulkAction) => run(action, false),
    retry: () => (confirmed ? run(confirmed, true) : Promise.resolve()),
    /** The dialog was closed: the next client's secret, if any. */
    nextSecret() {
      secrets.value = secrets.value.slice(1)
    },
    close() {
      phase.value = 'idle'
      rows.value = []
      problem.value = null
    },
  }
}
