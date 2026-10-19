// The relayhost of a domain or mailbox in its legacy position (research R9; legacy form map part
// 1b, decision 12): a field of UI 002's Domain section and UI 003's Mailbox section, saved with
// the section's Save through `PUT …/relayhost-assignment` with its own `If-Match`. The section
// treats it as a companion: it opens with the section, says whether it changed, saves after the
// section's patch, lists the stored value after an outdated save, and is discarded with it. A
// refusal (a missing flag, a relayhost deleted meanwhile) is shown at the field.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef } from 'vue'

import {
  problemOf,
  queryKeys,
  type ApiProblem,
  type DomainRelayhostAssignment,
  type MailboxRelayhostAssignment,
  type RelayhostReference,
} from '@/api'
import { lt } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import type { SectionChange, SectionCompanion } from '@/shared/components/editable-section'

import {
  fetchDomainAssignment,
  fetchMailboxAssignment,
  replaceDomainAssignment,
  replaceMailboxAssignment,
} from '../api/relayhost-assignments'
import { historyTarget } from '../history'
import { useRoutingIdentity } from './useRoutingIdentity'

type Assignment = DomainRelayhostAssignment | MailboxRelayhostAssignment

/** Legacy's option text `ID n: host (username)`, the host and username when known. */
export function relayhostLabel(
  reference: { id: number; host: string | null; username?: string | null } | null,
): string {
  if (!reference) return lt('edit.none_inherit')
  const host = reference.host ? `: ${reference.host}` : ''
  const username = reference.username ? ` (${reference.username})` : ''
  return `ID ${reference.id}${host}${username}`
}

export interface RelayhostAssignmentOptions {
  kind: 'domain' | 'mailbox'
  /** The domain's ASCII name or the mailbox's address. */
  name: () => string
  /** Whether the field is shown (legacy shows it to administrators and with the flag). */
  enabled: () => boolean
}

export function useRelayhostAssignment(options: RelayhostAssignmentOptions) {
  const client = useQueryClient()
  const { problemMessage, violationMessage } = useProblemMessages()
  const assignment = shallowRef<Assignment | null>(null)
  /** The chosen relayhost ID, or null for "None / Inherit". */
  const selected = ref<number | null>(null)
  const loading = ref(false)
  const loadProblem = shallowRef<ApiProblem | null>(null)
  const problem = shallowRef<ApiProblem | null>(null)
  const change = shallowRef<SectionChange | null>(null)
  /** Readable labels of chosen values (ID → `ID n: host (username)`). */
  const labels = ref<Record<string, string>>({})

  const stored = (value: Assignment | null): RelayhostReference | null => value?.relayhost ?? null
  /** Field violations (a relayhost deleted meanwhile) are shown at the field ... */
  const errors = computed(
    () => problem.value?.fieldErrors.get('relayhostId')?.map(violationMessage) ?? [],
  )

  async function load(): Promise<Assignment | null> {
    loading.value = true
    try {
      const value =
        options.kind === 'domain'
          ? await fetchDomainAssignment(options.name())
          : await fetchMailboxAssignment(options.name())
      const key =
        options.kind === 'domain'
          ? queryKeys.relayhostAssignments.domain(options.name())
          : queryKeys.relayhostAssignments.mailbox(options.name())
      client.setQueryData(key, value)
      loadProblem.value = null
      return value
    } catch (error) {
      loadProblem.value = problemOf(error)
      return null
    } finally {
      loading.value = false
    }
  }

  function remember(value: Assignment | null) {
    const reference = stored(value)
    if (reference)
      labels.value = { ...labels.value, [String(reference.id)]: relayhostLabel(reference) }
  }

  const companion: SectionCompanion = {
    open() {
      if (!options.enabled()) return
      problem.value = null
      change.value = null
      void load().then((value) => {
        assignment.value = value
        remember(value)
        selected.value = stored(value)?.id ?? null
      })
    },
    dirty: () =>
      options.enabled() &&
      !!assignment.value &&
      selected.value !== (stored(assignment.value)?.id ?? null),
    async save() {
      const current = assignment.value
      if (!current || !companion.dirty()) return 'unchanged'
      problem.value = null
      try {
        const saved =
          options.kind === 'domain'
            ? await replaceDomainAssignment(client, options.name(), selected.value, current.etag)
            : await replaceMailboxAssignment(client, options.name(), selected.value, current.etag)
        assignment.value = saved
        change.value = null
        return 'saved'
      } catch (error) {
        const failure = problemOf(error)!
        if (failure.status === 412) {
          const latest = await load()
          if (latest) {
            assignment.value = latest
            remember(latest)
            change.value = {
              field: 'relayhost',
              label: lt('edit.relayhost'),
              saved: relayhostLabel(stored(latest)),
            }
            return 'outdated'
          }
        }
        problem.value = failure
        if (failure.problemName === 'permission-flag-required') {
          void client.invalidateQueries({ queryKey: queryKeys.identity() })
        }
        return 'failed'
      }
    },
    outdated: () => (change.value ? [change.value] : []),
    discard() {
      change.value = null
      problem.value = null
      selected.value = stored(assignment.value)?.id ?? null
    },
    // ... and any other refusal as the section's status, because the field may be hidden after
    // the identity refresh of a missing flag.
    failure: () =>
      problem.value && errors.value.length === 0 ? problemMessage(problem.value) : null,
  }

  const { canSeeHistory } = useRoutingIdentity()
  /** The assignment's History target (administrators only; research R18). */
  const history = computed(() =>
    canSeeHistory.value
      ? historyTarget(
          options.kind === 'domain' ? 'domainRelayhostAssignment' : 'mailboxRelayhostAssignment',
          { name: options.name() },
        )
      : null,
  )

  return {
    companion,
    assignment,
    history,
    selected,
    labels,
    loading,
    loadProblem,
    /** The field's error messages: the refusal of the last save. */
    errors,
    remember: (id: string, label: string) => {
      labels.value = { ...labels.value, [id]: label }
    },
    /** Chooses a relayhost, or null for "None / Inherit". */
    choose: (id: number | null) => {
      selected.value = id
    },
  }
}

export type RelayhostAssignmentState = ReturnType<typeof useRelayhostAssignment>
