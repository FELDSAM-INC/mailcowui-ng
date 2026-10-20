<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { queryKeys, type SettingsCapabilities, type UiTexts } from '@/api'
import AnnouncementBanner from '@/app/shell/AnnouncementBanner.vue'
import { lt } from '@/i18n'
import EditableSection from '@/shared/components/EditableSection.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { invalidateBranding, uiTextsOptions, updateUiTexts } from '../../api/branding'
import { useSettingsSection } from '../../composables/useSettingsSection'
import {
  uiTextFields,
  uiTextPatch,
  uiTextErrors,
  type UiTextSection,
} from '../../lib/ui-text-draft'
import HtmlFieldPreview from './HtmlFieldPreview.vue'

const props = defineProps<{
  sectionId: UiTextSection
  resource: UiTexts
  capabilities: SettingsCapabilities
  editDisabledReason?: string | null
}>()
const emit = defineEmits<{ state: [state: { editing: boolean; dirty: boolean }] }>()
const { t } = useI18n()
const client = useQueryClient()
const labels = {
  pageTitle: 'admin.title_name',
  productName: 'admin.main_name',
  appsHeading: 'admin.apps_name',
  loginHelpHtml: 'admin.help_text',
  footerHtml: 'admin.ui_footer',
  announcement: 'admin.ui_header_announcement',
  'announcement.type': 'admin.ui_header_announcement',
  'announcement.text': 'admin.text',
  'announcement.active': 'admin.ui_header_announcement_active',
} as const
function label(field: string) {
  return lt(labels[field as keyof typeof labels])
}
const title = computed(() =>
  props.sectionId === 'names'
    ? t('systemSettings.uiTexts.names')
    : label(uiTextFields[props.sectionId][0]),
)
const fieldId = (path: string) => `ui-text-${path.replaceAll('.', '-')}`
const section = useSettingsSection({
  resource: () => props.resource,
  key: queryKeys.systemSettings.uiTexts(),
  fields: uiTextFields[props.sectionId],
  refetch: () => client.fetchQuery({ ...uiTextsOptions(), staleTime: 0 }),
  toDraft: (resource) => ({ ...resource, announcement: { ...resource.announcement } }),
  toPatch: (draft, base) => uiTextPatch(props.sectionId, draft, base),
  send: updateUiTexts,
  success: () => lt('success.ui_texts'),
  allowed: () => !props.capabilities.demoMode,
  fieldId: (path) => (path in labels ? fieldId(path) : null),
  afterSave: () => invalidateBranding(client),
})
const { editing, draft, saving, status, outdated, problem } = section
const rejectedPaste = ref<string | null>(null)
watch(
  [editing, section.dirty, saving],
  () => emit('state', { editing: editing.value, dirty: section.dirty.value || saving.value }),
  { immediate: true },
)
const changes = computed(() =>
  section.changes.value.map((change) => ({
    field: String(change.field),
    label: label(String(change.field)),
    saved:
      typeof change.savedValue === 'object'
        ? JSON.stringify(change.savedValue)
        : String(change.savedValue),
  })),
)
const value = computed(() => (editing.value && draft.value ? draft.value : props.resource))
const htmlField = computed(() => (props.sectionId === 'footer' ? 'footerHtml' : 'loginHelpHtml'))
const announcementType = computed({
  get: () => draft.value?.announcement.type ?? 'neutral',
  set: (type: string) => {
    if (draft.value)
      draft.value.announcement.type =
        type === 'neutral' ? null : (type as NonNullable<UiTexts['announcement']['type']>)
  },
})
const preview = computed(() =>
  value.value.announcement.active && value.value.announcement.text
    ? value.value.announcement
    : null,
)
const inputClass =
  'min-h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-600 dark:text-white'
function placeholder(field: 'pageTitle' | 'productName' | 'appsHeading') {
  return field === 'pageTitle'
    ? props.resource.pageTitleDefault
    : field === 'productName'
      ? props.resource.productNameDefault
      : lt('header.apps')
}
function open() {
  if (!props.editDisabledReason) {
    rejectedPaste.value = null
    section.open()
  }
}
async function paste(event: ClipboardEvent, field: string) {
  if (!/[\u0000-\u001f\u007f]/.test(event.clipboardData?.getData('text') ?? '')) return
  event.preventDefault()
  rejectedPaste.value = field
  await section.form.setClientMessages({ [field]: [t('systemSettings.uiTexts.singleLine')] })
}
function input() {
  if (rejectedPaste.value) {
    rejectedPaste.value = null
    section.form.clear()
  }
}
async function save(retry = false) {
  if (!draft.value || saving.value || props.capabilities.demoMode || rejectedPaste.value) return
  const errors = uiTextErrors(props.sectionId, draft.value)
  if (Object.keys(errors).length) {
    await section.form.setClientMessages(
      Object.fromEntries(
        Object.entries(errors).map(([path, rule]) => [
          path,
          [
            rule === 'singleLine'
              ? t('systemSettings.uiTexts.singleLine')
              : t('validation.tooLong', { max: props.sectionId === 'names' ? 255 : 65535 }),
          ],
        ]),
      ),
    )
    return
  }
  if (retry) await section.saveAgain()
  else await section.save()
}
</script>

<template>
  <EditableSection
    :section-id="sectionId"
    :title="title"
    :editable="!capabilities.demoMode"
    :edit-disabled-reason="editDisabledReason"
    :editing="editing"
    :saving="saving"
    :status="status"
    :outdated="changes"
    :version-changed="outdated"
    :can-save="!capabilities.demoMode"
    :save-label="lt('admin.save')"
    @edit="open"
    @save="save()"
    @save-again="save(true)"
    @cancel="section.discard"
    @discard="section.discard"
  >
    <dl v-if="sectionId === 'names'" class="space-y-3">
      <div v-for="field in uiTextFields.names" :key="field">
        <dt class="text-sm text-gray-600 dark:text-gray-400">{{ label(field) }}</dt>
        <dd class="wrap-anywhere">
          {{
            resource[field] ||
            t('systemSettings.uiTexts.emptyDefault', { value: placeholder(field) })
          }}
        </dd>
      </div>
    </dl>
    <template v-else-if="sectionId === 'announcement'">
      <AnnouncementBanner v-if="preview" :announcement="preview" preview />
      <p v-else>{{ t('systemSettings.uiTexts.announcementEmpty') }}</p>
    </template>
    <HtmlFieldPreview v-else :html="resource[htmlField]" />
    <template #form>
      <template v-if="draft">
        <ErrorSummary :id="section.form.summaryId" :items="section.form.summary.value" />
        <ProblemMessage
          :problem="
            section.form.formProblem.value ?? (section.form.hasErrors.value ? null : problem)
          "
        />
        <template v-if="sectionId === 'names'">
          <FormField
            v-for="field in uiTextFields.names"
            :id="fieldId(field)"
            :key="field"
            :label="label(field)"
            :errors="section.form.errorsFor(field)"
            :description="
              t(
                field === 'appsHeading'
                  ? 'systemSettings.uiTexts.appsHelp'
                  : 'systemSettings.uiTexts.emptyDefault',
                { value: placeholder(field) },
              )
            "
          >
            <template #default="control"
              ><input
                v-bind="control"
                v-model="draft[field]"
                type="text"
                :placeholder="placeholder(field)"
                :disabled="saving || capabilities.demoMode"
                :class="inputClass"
                @paste="paste($event, field)"
                @input="input"
            /></template>
          </FormField>
        </template>
        <template v-else-if="sectionId === 'announcement'">
          <FormField
            :id="fieldId('announcement.type')"
            :label="label('announcement.type')"
            :errors="section.form.errorsFor('announcement.type')"
          >
            <template #default="control"
              ><select
                v-bind="control"
                v-model="announcementType"
                :disabled="saving || capabilities.demoMode"
                :class="inputClass"
              >
                <option value="neutral">{{ t('systemSettings.uiTexts.neutral') }}</option>
                <option value="info">{{ lt('admin.ui_header_announcement_type_info') }}</option>
                <option value="warning">
                  {{ lt('admin.ui_header_announcement_type_warning') }}
                </option>
                <option value="danger">{{ lt('admin.ui_header_announcement_type_danger') }}</option>
              </select></template
            >
          </FormField>
          <FormField
            :id="fieldId('announcement.text')"
            :label="label('announcement.text')"
            :errors="section.form.errorsFor('announcement.text')"
            :description="t('systemSettings.uiTexts.announcementEmpty')"
          >
            <template #default="control">
              <textarea
                v-bind="control"
                v-model="draft.announcement.text"
                rows="4"
                :disabled="saving || capabilities.demoMode"
                :class="inputClass"
              />
            </template>
          </FormField>
          <LegacyText k="admin.ui_header_announcement_help" />
          <label class="flex min-h-11 items-center gap-3"
            ><input
              :id="fieldId('announcement.active')"
              v-model="draft.announcement.active"
              type="checkbox"
              :disabled="saving || capabilities.demoMode"
              class="size-5 shrink-0 accent-accent"
            />{{ label('announcement.active') }}</label
          >
          <div data-announcement-preview>
            <p class="mb-2 font-medium">{{ t('systemSettings.uiTexts.preview') }}</p>
            <AnnouncementBanner v-if="preview" :announcement="preview" preview />
            <p v-else>{{ t('systemSettings.uiTexts.announcementEmpty') }}</p>
          </div>
        </template>
        <template v-else>
          <FormField
            :id="fieldId(htmlField)"
            :label="label(htmlField)"
            :errors="section.form.errorsFor(htmlField)"
            :description="t('systemSettings.uiTexts.emptyHidden')"
            ><template #default="control">
              <textarea
                v-bind="control"
                v-model="draft[htmlField]"
                rows="8"
                :disabled="saving || capabilities.demoMode"
                :class="inputClass"
              /></template
          ></FormField>
          <p class="font-medium">{{ t('systemSettings.uiTexts.preview') }}</p>
          <HtmlFieldPreview :html="draft[htmlField]" />
        </template>
      </template>
    </template>
  </EditableSection>
</template>
