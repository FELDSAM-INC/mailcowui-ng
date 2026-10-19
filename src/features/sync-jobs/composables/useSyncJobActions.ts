// The actions on sync jobs (UI 008 research R14 to R16, FR-036 to FR-040), mirroring the classic
// mass actions on a selection ("Schedule next", "Activate", "Deactivate", "Remove") and the row
// action "Remove":
// - a selection is sent as one bulk request with each job's version as listed (FR-037); the
//   result has one row per job, failed, refused and outdated jobs stay selected, and "Retry" sends
//   them again with the refreshed list's versions; a lost connection reports every job as "outcome
//   unknown", clears the selection, refreshes the list and retries nothing;
// - deactivating asks one explicit confirmation listing the jobs, removing asks legacy's deletion
//   question with the jobs listed and their number typed; activating and scheduling do not ask;
// - removing one job sends its version; a 412 reloads it and asks again (FR-039).
import { useQueryClient } from '@tanstack/vue-query'
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  problemOf,
  queryKeys,
  type ApiProblem,
  type Role,
  type SyncJob,
  type SyncJobBulkAction,
} from '@/api'
import { lt } from '@/i18n'
import {
  isRetryable,
  rowsFromBulkResult,
  unknownRows,
  type BulkRow,
} from '@/shared/components/bulk-row'
import { announce } from '@/shared/composables/useAnnouncer'
import type { BulkSelection } from '@/shared/composables/useBulkSelection'
import { confirm } from '@/shared/composables/useConfirm'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'

import { applySyncJobBulkAction, deleteSyncJob, fetchSyncJob } from '../api'
import SyncJobDeleteList, { type AffectedJob } from '../components/SyncJobDeleteList.vue'
import { jobLabel } from '../presentation'

export interface SyncJobActionsOptions {
  selection: BulkSelection
  /** The jobs of the current page, as listed. */
  entries: () => readonly SyncJob[]
  role: () => Role
}

const affected = (job: SyncJob): AffectedJob => ({
  id: job.id,
  label: jobLabel(job),
  mailbox: job.mailbox,
  running: job.runStatus.running,
})
const entry = (job: SyncJob) => ({ name: String(job.id), unicodeName: jobLabel(job) })

export function useSyncJobActions(options: SyncJobActionsOptions) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const phase = ref<'idle' | 'running' | 'results'>('idle')
  const rows = shallowRef<BulkRow[]>([])
  const running = ref(0)
  const problem = shallowRef<ApiProblem | null>(null)
  /** The last single-job message (legacy's "Deleted syncjob ID …"). */
  const status = ref<string | null>(null)
  let lastAction: SyncJobBulkAction | null = null

  function ask(action: SyncJobBulkAction, jobs: readonly SyncJob[]): Promise<boolean> {
    const content = (kind: 'delete' | 'deactivate') => ({
      component: SyncJobDeleteList,
      props: { jobs: jobs.map(affected), kind, showOwner: options.role() !== 'mailboxUser' },
    })
    if (action === 'deactivate') {
      return confirm({
        title: t('syncJobs.bulk.deactivateTitle', { count: jobs.length }),
        content: content('deactivate'),
        confirmLabel: lt('mailbox.deactivate'),
        destructive: true,
      })
    }
    if (action === 'delete') {
      return confirm({
        title: lt('footer.confirm_delete'),
        content: content('delete'),
        confirmLabel: lt('footer.delete_now'),
        destructive: true,
        requireTyped: {
          accepted: [String(jobs.length)],
          labelKey: 'bulk.confirm.typeCount',
          labelParams: { count: jobs.length },
        },
      })
    }
    return Promise.resolve(true)
  }

  /** Waits for a list refetch that a previous action started, so a retry sends fresh versions. */
  async function settleList() {
    await queryClient.refetchQueries(
      { queryKey: queryKeys.syncJobs.lists(), type: 'active' },
      { cancelRefetch: false },
    )
  }

  async function run(action: SyncJobBulkAction, retrying = false) {
    if (phase.value === 'running') return
    if (retrying) await settleList()
    const ids = options.selection.ids.value
    const jobs = options.entries().filter((job) => ids.has(String(job.id)))
    if (jobs.length === 0) return
    // A retry repeats an action the user confirmed, for some of the same jobs.
    if (!retrying && !(await ask(action, jobs))) return
    lastAction = action
    problem.value = null
    status.value = null
    phase.value = 'running'
    running.value = jobs.length
    announce(t('bulk.progress', { count: jobs.length }))
    try {
      const result = await applySyncJobBulkAction(queryClient, {
        action,
        targets: jobs.map((job) => ({
          id: String(job.id),
          version: job.etag.replace(/^"|"$/g, ''),
        })),
      })
      rows.value = rowsFromBulkResult(result, jobs.map(entry))
      options.selection.keep(rows.value.filter(isRetryable).map((row) => row.id))
    } catch (error) {
      const failure = problemOf(error)!
      if (failure.kind === 'network') {
        rows.value = unknownRows(jobs.map(entry))
        options.selection.clear()
        void queryClient.invalidateQueries({ queryKey: queryKeys.syncJobs.lists() })
      } else {
        rows.value = []
        problem.value = failure
      }
    } finally {
      running.value = 0
    }
    phase.value = 'results'
  }

  /** The row action "Remove": legacy's question, If-Match, and a new question after a 412. */
  async function removeOne(job: SyncJob): Promise<boolean> {
    const question = (target: SyncJob) =>
      confirm({
        title: lt('footer.confirm_delete'),
        content: {
          component: SyncJobDeleteList,
          props: {
            jobs: [affected(target)],
            kind: 'delete',
            showOwner: options.role() !== 'mailboxUser',
          },
        },
        confirmLabel: lt('footer.delete_now'),
        destructive: true,
      })
    if (!(await question(job))) return false
    problem.value = null
    let current = job
    const versioned = useVersionedSave<SyncJob>({
      current: () => current,
      refetch: async () => {
        try {
          current = await fetchSyncJob(job.id)
          return current
        } catch {
          return undefined
        }
      },
    })
    const result = await versioned.remove(
      (ifMatch) => deleteSyncJob(queryClient, job.id, ifMatch),
      (latest) => (latest ? question(latest) : Promise.resolve(false)),
    )
    if (result.status === 'saved') {
      status.value = lt('success.deleted_syncjob', job.id)
      announce(status.value)
      return true
    }
    if (result.status === 'failed') problem.value = result.problem
    return false
  }

  return {
    phase,
    rows,
    running,
    problem,
    status,
    run,
    removeOne,
    retry: () => (lastAction ? run(lastAction, true) : Promise.resolve()),
    close() {
      phase.value = 'idle'
      rows.value = []
      problem.value = null
    },
  }
}
