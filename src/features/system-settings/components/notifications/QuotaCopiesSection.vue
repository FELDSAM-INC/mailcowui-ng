<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { problemOf, queryKeys } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import EditableSection from '@/shared/components/EditableSection.vue'
import EntryListField from '@/shared/components/EntryListField.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { parseEntryList } from '@/shared/validation/entry-list'
import { settingsCapabilitiesOptions } from '../../api/capabilities'
import { quotaCopiesOptions, updateQuotaCopies } from '../../api/notifications'
import { useSettingsSection } from '../../composables/useSettingsSection'
import { copiesDraft, copiesPatch, validateCopies } from '../../lib/quota'

// The domain page keys this section by domain; pending edits cannot move to another domain.
const props = defineProps<{ domain: string }>()
const domain = props.domain
const { t } = useI18n()
const format = useFormat()
const client = useQueryClient()
const identity = useIdentityQuery()
const admin = computed(() => identity.data.value?.role === 'admin')
const readable = computed(() => admin.value || identity.data.value?.role === 'domainAdmin')
const query = useQuery(computed(() => ({ ...quotaCopiesOptions(domain), enabled: readable.value })))
const caps = useQuery(computed(() => ({ ...settingsCapabilitiesOptions(), enabled: admin.value })))
// Domain administrators cannot call /capabilities/settings. Its fixed contract maxItems is 100.
const limit = computed(() =>
  admin.value ? caps.data.value?.limits.quotaNotificationRecipientsMax : 100,
)
const allowed = computed(
  () => readable.value && limit.value !== undefined && !caps.data.value?.demoMode,
)
const section = useSettingsSection({
  resource: () => query.data.value,
  key: queryKeys.quotaNotificationRecipients(domain),
  fields: ['recipients', 'active'],
  refetch: () => client.fetchQuery({ ...quotaCopiesOptions(domain), staleTime: 0 }),
  toDraft: copiesDraft,
  toPatch: copiesPatch,
  send: (patch, etag) => updateQuotaCopies(domain, patch, etag),
  allowed: () => allowed.value,
  fieldId: (path) =>
    path.startsWith('recipients')
      ? 'quota-copies-recipients'
      : path === 'active'
        ? 'quota-copies-active'
        : null,
  success: () => lt('success.domain_modified', domain),
})
const { editing, draft, dirty, saving, problem, status, outdated } = section
const unavailable = computed(
  () => problem.value?.status === 404 || problemOf(query.error.value)?.status === 404,
)
const entryErrors = computed(() =>
  Object.fromEntries(
    parseEntryList(draft.value?.recipients ?? '').map((entry) => [
      entry.index,
      section.form.errorsFor(`recipients.${entry.index}`),
    ]),
  ),
)
const changes = computed(() =>
  section.changes.value.map((change) => ({
    field: change.field,
    label: lt(change.field === 'recipients' ? 'edit.target_address' : 'edit.active'),
    saved: Array.isArray(change.savedValue)
      ? change.savedValue.join(', ')
      : t(change.savedValue ? 'domains.values.yes' : 'domains.values.no'),
  })),
)
async function save(retry = false) {
  if (
    !draft.value ||
    limit.value === undefined ||
    !allowed.value ||
    saving.value ||
    unavailable.value
  )
    return
  const errors = validateCopies(draft.value, limit.value)
  if (Object.keys(errors).length) {
    await section.form.setClientMessages(
      Object.fromEntries(
        Object.entries(errors).map(([field, key]) => [
          field,
          [t(key, { max: format.number(field === 'recipients' ? limit.value! : 255) })],
        ]),
      ),
    )
    return
  }
  if (retry) await section.saveAgain()
  else await section.save()
}
useLeaveGuard(
  computed(() => dirty.value || saving.value),
  'leaveGuard.body',
)
</script>
<template>
  <EditableSection
    v-if="readable"
    section-id="quota-copies"
    :title="lt('edit.quota_warning_bcc')"
    :editable="allowed && !!query.data.value && !unavailable"
    :editing="editing"
    :saving="saving"
    :status="status"
    :outdated="changes"
    :version-changed="outdated"
    :can-save="allowed && !unavailable"
    :save-label="lt('edit.save')"
    @edit="section.open"
    @save="save()"
    @save-again="save(true)"
    @cancel="section.discard"
    @discard="section.discard"
  >
    <template #header-actions
      ><HistoryLink v-if="admin" target-type="quotaNotificationRecipients" :target-id="domain"
    /></template>
    <p v-if="query.isPending.value" role="status">{{ lt('footer.loading') }}</p>
    <p v-else-if="unavailable" role="alert">{{ t('systemSettings.quotaCopies.unavailable') }}</p>
    <ProblemMessage
      v-else-if="!query.data.value"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <div v-else data-quota-copies-view class="space-y-3">
      <LegacyText k="edit.quota_warning_bcc_info" as="p" />
      <EntryListField
        id="saved-quota-copies"
        :label="lt('edit.target_address')"
        :model-value="query.data.value.recipients.join('\n')"
        readonly
        ><template #label><LegacyText k="edit.target_address" /></template
      ></EntryListField>
      <p>
        {{ lt('edit.active') }}:
        {{ t(query.data.value.active ? 'domains.values.yes' : 'domains.values.no') }}
      </p>
      <p
        v-if="!query.data.value.recipients.length"
        class="text-sm text-gray-600 dark:text-gray-400"
      >
        {{ t('systemSettings.quotaCopies.empty') }}
      </p>
      <ProblemMessage
        v-if="admin && caps.isError.value"
        :problem="problemOf(caps.error.value)"
        retry
        @retry="caps.refetch()"
      />
    </div>
    <template #form>
      <div v-if="draft" class="space-y-4">
        <LegacyText k="edit.quota_warning_bcc_info" as="p" />
        <p v-if="unavailable" role="alert">{{ t('systemSettings.quotaCopies.unavailable') }}</p>
        <ProblemMessage v-else :problem="section.form.formProblem.value ?? problem" />
        <EntryListField
          id="quota-copies-recipients"
          v-model="draft.recipients"
          :label="lt('edit.target_address')"
          :rows="10"
          :disabled="saving || !allowed || unavailable"
          :errors="section.form.errorsFor('recipients')"
          :entry-errors="entryErrors"
          ><template #label><LegacyText k="edit.target_address" /></template
        ></EntryListField>
        <label class="flex min-h-11 items-center gap-2 text-gray-900 dark:text-white"
          ><input
            id="quota-copies-active"
            v-model="draft.active"
            type="checkbox"
            :disabled="saving || !allowed || unavailable"
            class="size-5 accent-accent"
          />{{ lt('edit.active') }}</label
        >
        <p
          v-if="!parseEntryList(draft.recipients).length"
          role="status"
          class="text-sm text-gray-600 dark:text-gray-400"
        >
          {{ t('systemSettings.quotaCopies.empty') }}
        </p>
      </div>
    </template>
  </EditableSection>
</template>
