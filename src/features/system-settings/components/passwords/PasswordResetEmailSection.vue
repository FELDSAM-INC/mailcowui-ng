<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { problemOf, queryKeys, type SettingsCapabilities } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import EditableSection from '@/shared/components/EditableSection.vue'
import FormField from '@/shared/components/FormField.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useConfirm } from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { buttonVariants } from '@/shared/ui/button'
import {
  passwordResetOptions,
  updatePasswordResetNotification,
  usePasswordResetNotification,
} from '../../api/passwords'
import { useSettingsSection } from '../../composables/useSettingsSection'
import {
  notificationDraft,
  notificationFields,
  notificationPatch,
  resetWarnings,
  validateNotification,
} from '../../lib/password-reset'
import { replaceResetSamples } from '../../lib/email-samples'
import EmailPreviewDialog from '@/shared/components/email/EmailPreviewDialog.vue'
import { appBasePath } from '@/shared/platform/app-base'
import PlaceholderReference from './PlaceholderReference.vue'
import TemplateField from '@/shared/components/email/TemplateField.vue'

const linkPlaceholder = '{{link}}'
const props = defineProps<{ capabilities: SettingsCapabilities }>()
const { t, locale } = useI18n()
const format = useFormat()
const client = useQueryClient()
const confirm = useConfirm()
const query = usePasswordResetNotification()
const labels = {
  sender: 'admin.quota_notification_sender',
  subject: 'admin.quota_notification_subject',
  textTemplate: 'admin.password_reset_tmpl_text',
  htmlTemplate: 'admin.password_reset_tmpl_html',
} as const
const section = useSettingsSection({
  resource: () => query.data.value,
  key: queryKeys.systemSettings.passwordResetNotification(),
  fields: notificationFields,
  refetch: () => client.fetchQuery({ ...passwordResetOptions(), staleTime: 0 }),
  toDraft: notificationDraft,
  toPatch: notificationPatch,
  send: updatePasswordResetNotification,
  allowed: () => !props.capabilities.demoMode,
  fieldId: (path) => (notificationFields.some((key) => key === path) ? `reset-${path}` : null),
  success: () => lt('success.saved_settings'),
})
const { editing, draft, dirty, saving, outdated, status, problem } = section
const current = computed(() => (editing.value && draft.value ? draft.value : query.data.value))
const warnings = computed(() => (current.value ? resetWarnings(current.value) : null))
const changes = computed(() =>
  section.changes.value.map((change) => ({
    field: change.field,
    label: lt(labels[change.field as keyof typeof labels]),
    saved:
      change.field === 'sender' || change.field === 'subject'
        ? String(change.savedValue)
        : t('emailTemplate.templateChanged'),
  })),
)
const confirming = ref(false)
let disposed = false
onScopeDispose(() => {
  disposed = true
})
async function save(retry = false) {
  if (!draft.value || saving.value || confirming.value || props.capabilities.demoMode) return
  const errors = validateNotification(draft.value, props.capabilities.limits.templateMaxBytes)
  if (Object.keys(errors).length) {
    await section.form.setClientMessages(
      Object.fromEntries(
        Object.entries(errors).map(([field, key]) => [
          field,
          [
            t(key, {
              max:
                field === 'subject'
                  ? format.number(255)
                  : format.bytes(props.capabilities.limits.templateMaxBytes),
            }),
          ],
        ]),
      ),
    )
    return
  }
  if (
    query.data.value?.passwordResetAvailable &&
    (draft.value.sender === '' || draft.value.subject === '')
  ) {
    confirming.value = true
    try {
      if (
        !(await confirm({
          title: t('systemSettings.passwordReset.disableTitle'),
          description: t('systemSettings.passwordReset.disableBody'),
          confirmLabel: lt('user.save_changes'),
          destructive: true,
        }))
      )
        return
    } finally {
      confirming.value = false
    }
    if (disposed || props.capabilities.demoMode || !editing.value) return
  }
  if (retry) await section.saveAgain()
  else await section.save()
}
function restore() {
  if (!draft.value || saving.value || confirming.value || props.capabilities.demoMode) return
  draft.value.textTemplate = ''
  draft.value.htmlTemplate = ''
}
const preview = ref(false)
const previewHtml = ref('')
function openPreview() {
  if (!current.value) return
  previewHtml.value = replaceResetSamples(
    current.value.htmlTemplate,
    {
      link: `https://${props.capabilities.hostname}${appBasePath()}reset-password#sample-preview`,
      username: t('systemSettings.passwordReset.sampleMailbox'),
      username2: t('systemSettings.passwordReset.sampleRecovery'),
      hostname: props.capabilities.hostname,
      date: new Intl.DateTimeFormat(locale.value, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date()),
      token_lifetime: format.number(30),
    },
    true,
  )
  preview.value = true
}
useLeaveGuard(
  computed(() => dirty.value || saving.value),
  'leaveGuard.body',
)
</script>

<template>
  <section id="password-reset-email" class="min-w-0 space-y-4">
    <p v-if="query.isPending.value" role="status" aria-busy="true">{{ lt('footer.loading') }}</p>
    <ProblemMessage
      v-else-if="!query.data.value"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <template v-else>
      <p data-reset-availability role="status" class="text-sm text-gray-700 dark:text-gray-300">
        {{
          t(
            query.data.value.passwordResetAvailable
              ? 'systemSettings.passwordReset.available'
              : 'systemSettings.passwordReset.unavailable',
          )
        }}
      </p>
      <EditableSection
        section-id="password-reset"
        :title="lt('admin.password_reset_settings')"
        :editable="!capabilities.demoMode"
        :editing="editing"
        :saving="saving || confirming"
        :status="status"
        :outdated="changes"
        :version-changed="outdated"
        :can-save="!capabilities.demoMode"
        :save-label="lt('user.save_changes')"
        @edit="section.open"
        @save="save()"
        @save-again="save(true)"
        @cancel="section.discard"
        @discard="section.discard"
      >
        <template #header-actions><HistoryLink target-type="passwordResetNotification" /></template>
        <div class="space-y-4">
          <dl class="space-y-3">
            <div v-for="field in ['sender', 'subject'] as const" :key="field">
              <dt class="text-sm text-gray-600 dark:text-gray-400">{{ lt(labels[field]) }}</dt>
              <dd class="break-words text-gray-900 dark:text-white">
                {{ query.data.value[field] || '—' }}
              </dd>
            </div>
          </dl>
          <TemplateField
            v-for="field in ['textTemplate', 'htmlTemplate'] as const"
            :id="`saved-reset-${field}`"
            :key="field"
            :model-value="query.data.value[field]"
            :label="lt(labels[field])"
            :html="field === 'htmlTemplate'"
            :max-bytes="capabilities.limits.templateMaxBytes"
            :default-template="query.data.value.templatesAreDefault"
            readonly
            @preview="openPreview"
          />
        </div>
        <template #form>
          <div v-if="draft" data-reset-form class="min-w-0 space-y-4">
            <ProblemMessage :problem="section.form.formProblem.value ?? problem" />
            <PlaceholderReference />
            <div class="grid gap-4 sm:grid-cols-2">
              <FormField
                v-for="field in ['sender', 'subject'] as const"
                :id="`reset-${field}`"
                :key="field"
                :label="lt(labels[field])"
                :errors="section.form.errorsFor(field)"
                ><template #default="control"
                  ><input
                    v-bind="control"
                    v-model="draft[field]"
                    :type="field === 'sender' ? 'email' : 'text'"
                    :name="field"
                    autocapitalize="off"
                    autocorrect="off"
                    spellcheck="false"
                    :disabled="saving || confirming || capabilities.demoMode"
                    class="min-h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-600 dark:text-white" /></template
              ></FormField>
            </div>
            <TemplateField
              v-for="field in ['textTemplate', 'htmlTemplate'] as const"
              :id="`reset-${field}`"
              :key="field"
              v-model="draft[field]"
              :label="lt(labels[field])"
              :html="field === 'htmlTemplate'"
              :max-bytes="capabilities.limits.templateMaxBytes"
              :errors="section.form.errorsFor(field)"
              :disabled="saving || confirming || capabilities.demoMode"
              :default-template="
                query.data.value.templatesAreDefault && draft[field] === query.data.value[field]
              "
              @preview="openPreview"
            />
            <button
              data-restore-templates
              type="button"
              :disabled="saving || confirming || capabilities.demoMode"
              :class="buttonVariants({ variant: 'outline' })"
              @click="restore"
            >
              {{ t('systemSettings.passwordReset.restoreDefaults') }}
            </button>
            <p
              v-if="warnings?.restoresDefaults"
              role="status"
              class="text-sm text-gray-600 dark:text-gray-400"
            >
              {{ t('systemSettings.passwordReset.defaultsAfterSave') }}
            </p>
            <div
              v-if="warnings?.missingLink || warnings?.oneEmpty"
              data-template-warning
              role="status"
              class="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
            >
              <p v-if="warnings.missingLink">
                {{
                  t('systemSettings.passwordReset.missingLink', { placeholder: linkPlaceholder })
                }}
              </p>
              <p v-if="warnings.oneEmpty">{{ t('systemSettings.passwordReset.oneEmpty') }}</p>
            </div>
          </div>
        </template>
      </EditableSection>
      <div
        v-if="!editing && (warnings?.missingLink || warnings?.oneEmpty)"
        data-template-warning
        role="status"
        class="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      >
        <p v-if="warnings.missingLink">
          {{ t('systemSettings.passwordReset.missingLink', { placeholder: linkPlaceholder }) }}
        </p>
        <p v-if="warnings.oneEmpty">{{ t('systemSettings.passwordReset.oneEmpty') }}</p>
      </div>
      <details v-if="!editing" class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <summary
          class="min-h-11 cursor-pointer content-center font-medium text-gray-800 dark:text-gray-200"
        >
          {{ t('systemSettings.passwordReset.placeholders') }}
        </summary>
        <PlaceholderReference />
      </details>
      <EmailPreviewDialog v-if="preview" v-model:open="preview" :html="previewHtml" />
    </template>
  </section>
</template>
