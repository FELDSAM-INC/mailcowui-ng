import { computed, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue'
import type { QueryClient } from '@tanstack/vue-query'
import {
  problemOf,
  type ApiProblem,
  type MassMailJobCreateRequest,
  type MassMailPreviewParams,
} from '@/api'
import { createJob, previewOptions, type previewRecipients } from '../api/mass-mail'
import {
  selectionFromDraft,
  selectionKey,
  type SelectionDraft,
  type MessageDraft,
} from '../lib/selection'

interface ComposeOptions {
  client: QueryClient
  sender: string
  allowed: () => boolean
}
export function useMassMailCompose(options: ComposeOptions) {
  const draft = reactive<SelectionDraft & MessageDraft>({
    scope: 'all',
    domains: [],
    listMode: 'none',
    mailboxes: [],
    sender: options.sender,
    subject: '',
    textBody: '',
    htmlBody: '',
  })
  const selection = computed(() => selectionFromDraft(draft)),
    key = computed(() => selectionKey(selection.value))
  const previewData = shallowRef<Awaited<ReturnType<typeof previewRecipients>> | null>(null)
  const confirmation = shallowRef<MassMailJobCreateRequest | null>(null)
  const problem = shallowRef<ApiProblem | null>(null),
    pending = ref(false),
    sending = ref(false)
  const step = ref(1),
    countChanged = ref(false),
    runningJobId = ref<string | null>(null)
  const dirty = computed(() =>
    Boolean(
      draft.subject ||
      draft.textBody ||
      draft.htmlBody ||
      draft.sender !== options.sender ||
      draft.scope !== 'all' ||
      draft.listMode !== 'none',
    ),
  )
  let disposed = false,
    revision = 0,
    previewRequest = 0
  watch(
    key,
    () => {
      revision++
      previewData.value = null
      confirmation.value = null
      countChanged.value = false
      problem.value = null
    },
    { flush: 'sync' },
  )
  watch(
    () => [draft.sender, draft.subject, draft.textBody, draft.htmlBody],
    () => {
      confirmation.value = null
    },
    { flush: 'sync' },
  )
  onScopeDispose(() => {
    disposed = true
    revision++
    options.client.removeQueries({ queryKey: ['mass-mail-preview'] })
  })

  async function preview(params: MassMailPreviewParams = {}) {
    if (disposed) return
    const request = ++previewRequest
    const requestedRevision = revision
    pending.value = true
    problem.value = null
    confirmation.value = null
    try {
      const result = await options.client.fetchQuery(
        previewOptions(selection.value, { limit: 25, offset: 0, ...params }),
      )
      if (disposed || requestedRevision !== revision || request !== previewRequest) return
      previewData.value = result
    } catch (error) {
      if (disposed || requestedRevision !== revision || request !== previewRequest) return
      problem.value = problemOf(error)
      if (problem.value?.fieldErrors.size) step.value = 1
    } finally {
      if (!disposed && request === previewRequest) pending.value = false
    }
  }
  function confirm() {
    const count = previewData.value?.meta.recipientCount
    if (!count || pending.value || sending.value || disposed || !options.allowed()) return null
    confirmation.value = {
      sender: draft.sender,
      subject: draft.subject,
      textBody: draft.textBody,
      htmlBody: draft.htmlBody || null,
      selection: selection.value,
      expectedRecipients: count,
    }
    return confirmation.value
  }
  async function send() {
    const body = confirmation.value
    if (!body || sending.value || disposed || !options.allowed()) return null
    sending.value = true
    problem.value = null
    countChanged.value = false
    runningJobId.value = null
    try {
      const job = await createJob(body, options.client)
      if (disposed) return null
      Object.assign(draft, {
        scope: 'all',
        domains: [],
        listMode: 'none',
        mailboxes: [],
        sender: options.sender,
        subject: '',
        textBody: '',
        htmlBody: '',
      })
      confirmation.value = null
      previewData.value = null
      return job
    } catch (error) {
      if (disposed) return null
      const failure = problemOf(error)
      problem.value = failure
      confirmation.value = null
      if (failure?.is('mass-mail-recipient-count-changed')) {
        countChanged.value = true
        step.value = 3
        await preview()
      } else if (failure?.is('mass-mail-already-running')) {
        const id = failure.extensions.runningJobId
        if (typeof id === 'string' && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)) runningJobId.value = id
      } else if (failure?.fieldErrors.size) step.value = 1
      return null
    } finally {
      if (!disposed) sending.value = false
    }
  }
  return {
    draft,
    selection,
    selectionKey: key,
    previewData,
    confirmation,
    problem,
    pending,
    sending,
    step,
    dirty,
    countChanged,
    runningJobId,
    preview,
    confirm,
    send,
  }
}
