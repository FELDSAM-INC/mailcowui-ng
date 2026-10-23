<script setup lang="ts">
import { computed, nextTick, onScopeDispose, reactive, ref, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { RouterLink, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { SettingsCapabilities } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import PageHeader from '@/shared/components/PageHeader.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import FormField from '@/shared/components/FormField.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import CodeEditor from '@/shared/components/code-editor/CodeEditor.vue'
import EmailPreviewDialog from '@/shared/components/email/EmailPreviewDialog.vue'
import { buttonVariants } from '@/shared/ui/button'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useConfirm } from '@/shared/composables/useConfirm'
import { useMassMailCompose } from '../../composables/useMassMailCompose'
import { composeStepForField, validateMassMail } from '../../lib/selection'
import RecipientSelection from '../../components/mass-mail/RecipientSelection.vue'
import RecipientPreview from '../../components/mass-mail/RecipientPreview.vue'
import SendConfirmDialog from '../../components/mass-mail/SendConfirmDialog.vue'

const props = defineProps<{ capabilities: SettingsCapabilities }>()
const { t } = useI18n(),
  format = useFormat(),
  router = useRouter(),
  confirm = useConfirm()
const wide = useMediaQuery('(min-width: 1024px)')
const compose = useMassMailCompose({
  client: useQueryClient(),
  sender: props.capabilities.massMail.suggestedSender,
  allowed: () => !props.capabilities.demoMode,
})
const { draft, previewData, pending, sending, step, countChanged, runningJobId } = compose
const summary = computed(() =>
  [
    draft.scope === 'domains' ? draft.domains.join(', ') : t('systemSettings.massMail.all'),
    t(`systemSettings.massMail.${draft.listMode}`),
    ...(draft.listMode === 'none' ? [] : draft.mailboxes),
  ].join(' · '),
)
const form = useProblemForm({
  formKey: 'systemSettings.massMail.form',
  fieldId: (path) =>
    path.startsWith('selection.domains')
      ? 'mass-domains'
      : path.startsWith('selection.include') || path.startsWith('selection.exclude')
        ? 'mass-mailboxes'
        : path === 'selection'
          ? 'mass-scope'
          : ['sender', 'subject', 'textBody', 'htmlBody'].includes(path)
            ? `mass-${path}`
            : null,
})
const heading = ref<HTMLElement>(),
  sendButton = ref<HTMLButtonElement>(),
  previewHtml = ref(false)
let canFocusFailure = true
let requestOrigin: Element | null = null
let closingDialog: Element | null = null
function pendingFocus(event: FocusEvent) {
  const target = event.target as Node | null
  if (
    target !== document.body &&
    target !== requestOrigin &&
    target !== sendButton.value &&
    !closingDialog?.contains(target)
  )
    canFocusFailure = false
}
function stopTrackingFocus() {
  document.removeEventListener('focusin', pendingFocus)
}
watch(
  [pending, sending],
  (busy, before) => {
    if (busy.some(Boolean) === before.some(Boolean)) return
    stopTrackingFocus()
    if (busy.some(Boolean)) {
      canFocusFailure = true
      requestOrigin = document.activeElement
      // The confirmation can still be closing when sending begins. Its own focus and the return
      // to Send belong to this action; moving to another control relinquishes focus ownership.
      closingDialog = requestOrigin?.closest('[role="alertdialog"]') ?? null
      document.addEventListener('focusin', pendingFocus)
    }
  },
  { flush: 'sync' },
)
watch(compose.problem, (problem) => {
  void form.setProblem(problem, { focus: canFocusFailure })
})
const previewParams = reactive({ page: 1, size: 25, q: '' })
watch(compose.selectionKey, () => {
  Object.assign(previewParams, { page: 1, size: 25, q: '' })
  if (timer) clearTimeout(timer)
})
const stepTitles = computed(() => [
  lt('admin.recipients'),
  t('systemSettings.massMail.message'),
  t('systemSettings.massMail.preview'),
  lt('admin.send'),
])
watch(step, async () => {
  await nextTick()
  // API errors focus their field or summary after the selected step becomes visible.
  if (!compose.problem.value?.fieldErrors.size) heading.value?.focus()
})
async function revealErrorField(event: MouseEvent) {
  const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null
  const fieldId = link?.getAttribute('href')?.slice(1)
  const item = form.summary.value.find((entry) => entry.fieldId === fieldId)
  const targetStep = item ? composeStepForField(item.path) : null
  if (!targetStep || !fieldId) return
  event.preventDefault()
  event.stopPropagation()
  step.value = targetStep
  await nextTick()
  const field = document.getElementById(fieldId)
  field?.focus()
  field?.scrollIntoView?.({ block: 'center' })
}
useLeaveGuard(
  computed(() => compose.dirty.value || sending.value),
  'leaveGuard.body',
)
let timer: ReturnType<typeof setTimeout> | undefined
onScopeDispose(() => {
  if (timer) clearTimeout(timer)
  stopTrackingFocus()
})
async function valid() {
  form.clear()
  const errors: Record<string, string[]> = {}
  if (draft.scope === 'domains' && !draft.domains.length)
    errors['selection.domains'] = [t('validation.required')]
  if (draft.domains.length > props.capabilities.massMail.maxSelectionEntries)
    errors['selection.domains'] = [
      t('validation.tooMany', { max: props.capabilities.massMail.maxSelectionEntries }),
    ]
  if (draft.mailboxes.length > props.capabilities.massMail.maxSelectionEntries)
    errors[`selection.${draft.listMode}`] = [
      t('validation.tooMany', { max: props.capabilities.massMail.maxSelectionEntries }),
    ]
  if (Object.keys(errors).length) {
    step.value = 1
    await form.setClientMessages(errors)
    return false
  }
  for (const [field, key] of Object.entries(
    validateMassMail(draft, props.capabilities.massMail.maxBodyBytes),
  ))
    errors[field] = [
      key === 'sender'
        ? lt('danger.from_invalid')
        : key === 'subject'
          ? lt('danger.subject_empty')
          : key === 'subjectSingleLine'
            ? t('emailTemplate.singleLine')
            : key === 'subjectTooLong'
              ? t('validation.tooLong', { max: 255 })
              : key === 'textBody'
                ? lt('danger.text_empty')
                : t('validation.tooLongBytes', {
                    max: format.bytes(props.capabilities.massMail.maxBodyBytes),
                  }),
    ]
  if (Object.keys(errors).length) {
    step.value = 2
    await form.setClientMessages(errors)
    return false
  }
  return true
}
async function loadPreview() {
  await compose.preview({
    q: previewParams.q || undefined,
    offset: (previewParams.page - 1) * previewParams.size,
    limit: previewParams.size,
  })
}
async function preview() {
  if (await valid()) {
    step.value = 3
    await loadPreview()
  }
}
function changePreview(next: Partial<typeof previewParams>) {
  Object.assign(previewParams, next)
  if (timer) clearTimeout(timer)
  timer = setTimeout(
    () => {
      void loadPreview()
    },
    next.q === undefined ? 0 : 300,
  )
}
async function next() {
  if (step.value === 1) {
    step.value = 2
    return
  }
  if (step.value === 2) await preview()
  else if (step.value === 3 && previewData.value?.meta.recipientCount) step.value = 4
}
async function send() {
  if (compose.confirmation.value || sending.value) return
  if (!(await valid()) || compose.confirmation.value || sending.value) return
  const message = compose.confirm()
  if (!message) return
  const accepted = await confirm({
    title: t('systemSettings.massMail.confirmTitle'),
    confirmLabel: t(
      'systemSettings.massMail.sendCount',
      { count: format.number(message.expectedRecipients) },
      message.expectedRecipients,
    ),
    content: { component: SendConfirmDialog, props: { message, summary: summary.value } },
  })
  if (!accepted) {
    compose.confirmation.value = null
    return
  }
  const job = await compose.send()
  if (job) await router.push({ name: 'system-settings-mass-mail-job', params: { jobId: job.id } })
}
</script>
<template>
  <div class="min-w-0 space-y-4" data-mass-mail-compose>
    <PageHeader :title="lt('admin.sys_mails')"
      ><template #actions><HistoryLink target-type="massMailJob" /></template
    ></PageHeader>
    <p v-if="capabilities.demoMode" data-mass-mail-demo role="status">
      {{ lt('danger.demo_mode_enabled') }}
    </p>
    <template v-else>
      <p v-if="!wide" role="status">{{ t('systemSettings.massMail.step', { step }) }}</p>
      <h2 v-if="!wide" ref="heading" tabindex="-1" class="text-xl font-semibold">
        {{ stepTitles[step - 1] }}
      </h2>
      <ErrorSummary
        :id="form.summaryId"
        :items="form.summary.value"
        @click.capture="revealErrorField"
      />
      <ProblemMessage v-if="!runningJobId" :problem="form.formProblem.value" />
      <p v-if="countChanged" role="alert">{{ t('systemSettings.massMail.countChanged') }}</p>
      <div v-if="runningJobId" data-running-conflict role="alert" class="space-y-2">
        <p>{{ t('systemSettings.massMail.runningConflict') }}</p>
        <RouterLink
          :to="{ name: 'system-settings-mass-mail-job', params: { jobId: runningJobId } }"
          :class="buttonVariants({ variant: 'outline' })"
          >{{ t('systemSettings.massMail.viewJob') }}</RouterLink
        >
      </div>
      <fieldset
        :disabled="sending || pending || !!compose.confirmation.value"
        class="min-w-0 space-y-5"
      >
        <section v-show="wide || step === 1" class="space-y-3">
          <h2 v-if="wide" class="text-xl font-semibold">
            {{ lt('admin.recipients') }}
          </h2>
          <RecipientSelection
            v-model:draft="compose.draft"
            :errors="form.errorsFor"
            :max="capabilities.massMail.maxSelectionEntries"
          />
        </section>
        <section v-show="wide || step === 2" class="space-y-4">
          <h2 v-if="wide" class="text-xl font-semibold">
            {{ t('systemSettings.massMail.message') }}
          </h2>
          <FormField id="mass-sender" :label="lt('admin.from')" :errors="form.errorsFor('sender')"
            ><template #default="control"
              ><input
                v-bind="control"
                v-model="draft.sender"
                type="email"
                autocomplete="off"
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
                class="form-control" /></template
          ></FormField>
          <FormField
            id="mass-subject"
            :label="lt('admin.subject')"
            :errors="form.errorsFor('subject')"
            ><template #default="control"
              ><input
                v-bind="control"
                v-model="draft.subject"
                autocomplete="off"
                class="form-control" /></template
          ></FormField>
          <CodeEditor
            id="mass-textBody"
            v-model="draft.textBody"
            :label="lt('admin.text')"
            :max-bytes="capabilities.massMail.maxBodyBytes"
            :line-numbers="false"
            :errors="form.errorsFor('textBody')"
          />
          <CodeEditor
            id="mass-htmlBody"
            v-model="draft.htmlBody"
            :label="`${lt('admin.html')} (${lt('admin.optional')})`"
            :max-bytes="capabilities.massMail.maxBodyBytes"
            :line-numbers="false"
            :errors="form.errorsFor('htmlBody')"
          />
          <button
            type="button"
            :disabled="!draft.htmlBody"
            :class="buttonVariants({ variant: 'outline' })"
            @click="previewHtml = true"
          >
            {{ t('emailTemplate.preview') }}
          </button>
        </section>
      </fieldset>
      <section v-show="wide || step === 3" class="space-y-4">
        <h2 v-if="wide" class="text-xl font-semibold">
          {{ t('systemSettings.massMail.preview') }}
        </h2>
        <button
          v-if="wide"
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :disabled="pending || sending"
          @click="preview"
        >
          {{ t('systemSettings.massMail.preview') }}
        </button>
        <p v-if="pending" role="status" aria-busy="true">{{ lt('footer.loading') }}</p>
        <RecipientPreview
          v-if="previewData"
          :data="previewData.data"
          :count="previewData.meta.recipientCount"
          :total="previewData.meta.total"
          :q="previewParams.q"
          :page="previewParams.page"
          :size="previewParams.size"
          @change="changePreview"
        />
      </section>
      <section v-show="wide || step === 4" class="space-y-4">
        <h2 v-if="wide" class="text-xl font-semibold">{{ lt('admin.send') }}</h2>
        <p class="wrap-anywhere">{{ summary }}</p>
        <button
          ref="sendButton"
          type="button"
          :class="buttonVariants({ variant: 'default' })"
          :disabled="
            !previewData?.meta.recipientCount || pending || sending || !!compose.confirmation.value
          "
          :aria-busy="sending ? 'true' : undefined"
          @click="send"
        >
          {{ lt('admin.send') }}
        </button>
      </section>
      <div v-if="!wide" class="flex gap-3" data-compose-step-actions>
        <button
          v-if="step > 1"
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :disabled="pending || sending"
          @click="step--"
        >
          {{ t('systemSettings.massMail.back') }}</button
        ><button
          v-if="step < 4"
          type="button"
          :class="buttonVariants({ variant: 'default' })"
          :disabled="pending || (step === 3 && !previewData?.meta.recipientCount)"
          @click="next"
        >
          {{ t('systemSettings.massMail.next') }}
        </button>
      </div>
    </template>
    <EmailPreviewDialog v-if="previewHtml" v-model:open="previewHtml" :html="draft.htmlBody" />
  </div>
</template>
