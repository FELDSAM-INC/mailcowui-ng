// The action runner of one container (research R8, data-model §7, FR-012–FR-016): start without a
// confirmation; stop and restart after one (legacy's restart dialog; a stop dialog titled like it);
// one action at a time per container, with its progress and elapsed time; the outcome as legacy's
// texts ("OK", "Already running", "Not running"), problems as their translated messages, and
// "Outcome unknown" when the answer is a timeout or never arrives, after which the container is
// read once and shown. Nothing is ever repeated on its own. The request runs through the mutation
// cache, so its outcome arrives after the card is gone; it is then shown as an app-level status
// message. A missing audit record (`Audit-Recorded: false`) adds a warning.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, readonly, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  problemOf,
  runMutation,
  type ApiProblem,
  type Container,
  type ContainerAction,
} from '@/api'
import { captureSessionScope } from '@/api/session-scope'
import { lt } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import { announce } from '@/shared/composables/useAnnouncer'
import { useConfirm } from '@/shared/composables/useConfirm'
import { pushStatusMessage, type StatusTone } from '@/shared/composables/useStatusMessage'

import { fetchContainer, sendContainerAction, writeContainer } from '../api'
import RestartNotice from '../components/RestartNotice.vue'
import { operationsKeys } from '../../query-keys'

export interface ActionOutcome {
  tone: StatusTone
  text: string
  /** A second line: the explanation of an unknown outcome. */
  detail?: string
  auditRecorded: boolean
}

export function useContainerAction(container: () => Container) {
  const client = useQueryClient()
  const { t } = useI18n()
  const confirm = useConfirm()
  const { problemMessage } = useProblemMessages()

  const status = ref<'idle' | 'sending' | 'readingState'>('idle')
  const action = ref<ContainerAction | null>(null)
  const elapsed = ref(0)
  const outcome = shallowRef<ActionOutcome | null>(null)
  let mounted = true
  let ticker: ReturnType<typeof setInterval> | null = null

  function stopTicker() {
    if (ticker !== null) clearInterval(ticker)
    ticker = null
  }
  onScopeDispose(() => {
    mounted = false
    stopTicker()
  })

  const progress = computed(() => {
    if (status.value === 'idle' || !action.value) return ''
    if (action.value === 'restart') return lt('footer.restarting_container')
    return t(
      action.value === 'start'
        ? 'operations.containers.starting'
        : 'operations.containers.stopping',
    )
  })

  async function confirmed(next: ContainerAction, name: string): Promise<boolean> {
    if (next === 'start') return true
    if (next === 'restart') {
      return confirm({
        title: `${lt('footer.restart_container')} (${name})`,
        content: { component: RestartNotice },
        confirmLabel: lt('footer.restart_now'),
        cancelLabel: lt('footer.cancel'),
      })
    }
    return confirm({
      title: `${t('operations.containers.stopTitle')} (${name})`,
      confirmLabel: t('operations.containers.stopNow'),
      cancelLabel: lt('footer.cancel'),
      destructive: true,
    })
  }

  function report(name: string, result: ActionOutcome) {
    outcome.value = result
    const message = t('operations.containers.announce', { name, outcome: result.text })
    if (mounted) {
      announce(message, { assertive: result.tone === 'danger' || result.tone === 'warning' })
    } else {
      pushStatusMessage({ text: message, tone: result.tone })
    }
    if (!result.auditRecorded) {
      const warning = t('operations.notRecorded')
      if (mounted) announce(warning, { assertive: true })
      else pushStatusMessage({ text: `${name}: ${warning}`, tone: 'warning' })
    }
  }

  async function readAgain(name: string) {
    const scope = captureSessionScope()
    status.value = 'readingState'
    try {
      writeContainer(client, await scope.run(() => fetchContainer(name)))
    } catch {
      // The container is shown as listed; the list keeps polling.
    }
  }

  function problemOutcome(problem: ApiProblem): ActionOutcome {
    const serviceMessage =
      typeof problem.extensions.serviceMessage === 'string'
        ? problem.extensions.serviceMessage
        : undefined
    if (problem.is('container-action-failed') && !serviceMessage) {
      return { tone: 'danger', text: lt('danger.unknown'), auditRecorded: problem.auditRecorded }
    }
    return {
      tone: 'danger',
      text: problemMessage(problem),
      auditRecorded: problem.auditRecorded,
    }
  }

  async function run(next: ContainerAction): Promise<void> {
    if (status.value !== 'idle') return
    const name = container().name
    if (!(await confirmed(next, name))) return
    action.value = next
    outcome.value = null
    status.value = 'sending'
    const started = Date.now()
    elapsed.value = 0
    ticker = setInterval(() => {
      elapsed.value = Math.floor((Date.now() - started) / 1000)
    }, 1000)
    announce(progress.value)
    try {
      const answer = await runMutation(
        client,
        {
          mutationKey: ['containers', 'action', name],
          mutationFn: () => sendContainerAction(name, next),
        },
        undefined,
      )
      writeContainer(client, answer.result.container)
      const already = answer.result.outcome === 'alreadyInState'
      const text = !already
        ? t('operations.containers.ok')
        : next === 'stop'
          ? t('operations.containers.notRunning')
          : next === 'start'
            ? t('operations.containers.alreadyRunning')
            : t('operations.containers.ok')
      report(name, {
        tone: already ? 'info' : 'success',
        text,
        auditRecorded: answer.auditRecorded,
      })
    } catch (error) {
      const problem = problemOf(error)!
      if (problem.kind === 'identityChanged') return
      if (problem.kind === 'network' || problem.is('outcome-unknown')) {
        report(name, {
          tone: 'warning',
          text: t('bulk.outcome.unknown'),
          detail: t('problem.outcome-unknown'),
          auditRecorded: problem.auditRecorded,
        })
        await readAgain(name)
      } else if (problem.status === 404) {
        report(name, problemOutcome(problem))
        await client.invalidateQueries({ queryKey: operationsKeys.monitoring.containers() })
      } else {
        report(name, problemOutcome(problem))
        // The service refused: its message is in the outcome ("Error: …"); show the state.
        if (problem.is('container-action-failed')) await readAgain(name)
      }
    } finally {
      stopTicker()
      status.value = 'idle'
    }
  }

  return {
    status: readonly(status),
    action: readonly(action),
    elapsed: readonly(elapsed),
    progress,
    outcome,
    pending: computed(() => status.value !== 'idle'),
    run,
  }
}
