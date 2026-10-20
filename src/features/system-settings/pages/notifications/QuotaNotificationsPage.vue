<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { problemOf, queryKeys, type SettingsCapabilities } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import EditableSection from '@/shared/components/EditableSection.vue'
import FormField from '@/shared/components/FormField.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import TemplateField from '@/shared/components/email/TemplateField.vue'
import EmailPreviewDialog from '@/shared/components/email/EmailPreviewDialog.vue'
import { buttonVariants } from '@/shared/ui/button'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { quotaNotificationOptions, updateQuotaNotification } from '../../api/notifications'
import { useSettingsSection } from '../../composables/useSettingsSection'
import { quotaDraft, quotaFields, quotaPatch } from '../../lib/quota'
import { validateNotification } from '../../lib/password-reset'
import { replaceResetSamples } from '../../lib/email-samples'

const props = defineProps<{ capabilities: SettingsCapabilities }>()
const { t } = useI18n()
const format = useFormat()
const client = useQueryClient()
const query = useQuery(quotaNotificationOptions())
const labels = {
  sender: 'admin.quota_notification_sender',
  subject: 'admin.quota_notification_subject',
  htmlTemplate: 'admin.quarantine_notification_html',
} as const
const section = useSettingsSection({
  resource: () => query.data.value,
  key: queryKeys.systemSettings.quotaNotification(),
  fields: quotaFields,
  refetch: () => client.fetchQuery({ ...quotaNotificationOptions(), staleTime: 0 }),
  toDraft: quotaDraft,
  toPatch: quotaPatch,
  send: updateQuotaNotification,
  allowed: () => !props.capabilities.demoMode,
  fieldId: (path) => (quotaFields.some((field) => field === path) ? `quota-${path}` : null),
  success: () => lt('success.saved_settings'),
})
const { editing, draft, dirty, saving, status, outdated, problem } = section
const changes = computed(() =>
  section.changes.value.map((change) => ({
    field: change.field,
    label: lt(labels[change.field as keyof typeof labels]),
    saved:
      change.field === 'htmlTemplate'
        ? t('emailTemplate.templateChanged')
        : String(change.savedValue),
  })),
)
async function save(retry = false) {
  if (!draft.value || saving.value || props.capabilities.demoMode) return
  const errors = validateNotification(
    { ...draft.value, textTemplate: '' },
    props.capabilities.limits.templateMaxBytes,
  )
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
  if (retry) await section.saveAgain()
  else await section.save()
}
const preview = ref(false)
const previewHtml = ref('')
function openPreview() {
  const current = editing.value ? draft.value : query.data.value
  if (!current) return
  previewHtml.value = replaceResetSamples(
    current.htmlTemplate,
    { username: t('systemSettings.passwordReset.sampleMailbox') },
    true,
  ).replaceAll('{{percent}}', format.number(95))
  preview.value = true
}
useLeaveGuard(
  computed(() => dirty.value || saving.value),
  'leaveGuard.body',
)
</script>
<template>
  <div data-quota-notifications class="min-w-0 space-y-4">
    <PageHeader :title="lt('admin.quota_notifications')"
      ><template #actions><HistoryLink target-type="quotaNotification" /></template
    ></PageHeader>
    <LegacyText k="admin.quota_notifications_info" as="p" />
    <p v-if="query.isPending.value" role="status">{{ lt('footer.loading') }}</p>
    <ProblemMessage
      v-else-if="!query.data.value"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <EditableSection
      v-else
      section-id="notification-email"
      :title="lt('admin.quota_notifications')"
      :editable="!capabilities.demoMode"
      :editing="editing"
      :saving="saving"
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
      <div class="space-y-4">
        <dl class="space-y-3">
          <div v-for="field in ['sender', 'subject'] as const" :key="field">
            <dt class="text-sm text-gray-600 dark:text-gray-400">{{ lt(labels[field]) }}</dt>
            <dd class="break-words text-gray-900 dark:text-white">
              {{ query.data.value[field] }}
              <span
                v-if="query.data.value[`${field}IsDefault`]"
                data-default-value
                class="ms-2 text-xs"
                >({{ t('systemSettings.quota.defaultValue') }})</span
              >
            </dd>
          </div>
        </dl>
        <TemplateField
          id="saved-quota-htmlTemplate"
          :model-value="query.data.value.htmlTemplate"
          :label="lt(labels.htmlTemplate)"
          :max-bytes="capabilities.limits.templateMaxBytes"
          :default-template="query.data.value.htmlTemplateIsDefault"
          html
          readonly
          @preview="openPreview"
        />
      </div>
      <template #form
        ><div v-if="draft" class="min-w-0 space-y-4">
          <ProblemMessage :problem="section.form.formProblem.value ?? problem" />
          <div class="grid gap-4 sm:grid-cols-2">
            <FormField
              v-for="field in ['sender', 'subject'] as const"
              :id="`quota-${field}`"
              :key="field"
              :label="lt(labels[field])"
              :errors="section.form.errorsFor(field)"
              :description="t('systemSettings.quota.emptyDefaults')"
              ><template #default="control"
                ><input
                  v-bind="control"
                  v-model="draft[field]"
                  :name="field"
                  :type="field === 'sender' ? 'email' : 'text'"
                  :placeholder="field === 'sender' ? 'quota-warning@localhost' : 'Quota warning'"
                  :disabled="saving || capabilities.demoMode"
                  autocapitalize="off"
                  autocorrect="off"
                  spellcheck="false"
                  class="min-h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-600 dark:text-white" /></template
            ></FormField>
          </div>
          <TemplateField
            id="quota-htmlTemplate"
            v-model="draft.htmlTemplate"
            :label="lt(labels.htmlTemplate)"
            :max-bytes="capabilities.limits.templateMaxBytes"
            :errors="section.form.errorsFor('htmlTemplate')"
            :disabled="saving || capabilities.demoMode"
            :default-template="
              query.data.value.htmlTemplateIsDefault &&
              draft.htmlTemplate === query.data.value.htmlTemplate
            "
            html
            @preview="openPreview"
          />
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline' })"
            :disabled="saving || capabilities.demoMode"
            @click="draft.htmlTemplate = ''"
          >
            {{ t('systemSettings.quota.restore') }}
          </button>
        </div></template
      >
    </EditableSection>
    <section id="notification-template" class="space-y-2 text-sm text-gray-700 dark:text-gray-300">
      <LegacyText k="admin.quota_notifications_vars" as="p" />
      <p>{{ t('systemSettings.quota.fallback') }}</p>
    </section>
    <section
      id="copies"
      class="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700"
    >
      <h2 class="font-semibold text-gray-900 dark:text-white">
        {{ lt('edit.quota_warning_bcc') }}
      </h2>
      <p class="text-gray-700 dark:text-gray-300">{{ t('systemSettings.quota.copies') }}</p>
      <RouterLink :to="{ name: 'domains' }" :class="buttonVariants({ variant: 'outline' })">{{
        t('systemSettings.quota.manageCopies')
      }}</RouterLink>
    </section>
    <EmailPreviewDialog v-if="preview" v-model:open="preview" :html="previewHtml" />
  </div>
</template>
