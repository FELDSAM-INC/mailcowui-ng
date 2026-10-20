<script setup lang="ts">
// The quarantine settings as one section with one save (UI 006 US7, FR-059 to FR-063, legacy form
// map screen 8, D11, D12, D14): `templates/admin/tab-config-quarantine.twig` in legacy order with
// legacy's dividers. Labels that carry their help (`<br><small>`) are shown whole through
// LegacyText; values that come from the server (addresses, subject, template) are plain text. The
// template is source text in a monospace field, never rendered, collapsed behind its label as
// legacy's legend; above `notificationTemplateMaxBytes` the save is blocked. A save sends the
// changed members with `If-Match`; an empty template, sender or subject restores the default (D14).
// Outcomes: legacy's `success.saved_settings`; field errors on the fields and in the summary; a
// 412 keeps the input and lists the values changed elsewhere; a 503 says nothing was changed.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, reactive, ref, shallowRef, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { queryKeys, type ApiProblem, type QuarantineSettings } from '@/api'
import { lt, text, type LegacyKey } from '@/i18n'
import { useFormat } from '@/i18n/format'
import type { SectionChange, SectionStatus } from '@/shared/components/editable-section'
import EditableSection from '@/shared/components/EditableSection.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import LocaleNumberField from '@/shared/components/LocaleNumberField.vue'
import PlainText from '@/shared/components/PlainText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useClientErrors } from '@/shared/composables/useClientErrors'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { changedSince, useVersionedSave } from '@/shared/composables/useVersionedSave'
import { ChevronDownIcon } from '@/shared/icons'
import { sanitizeLegacyHtml } from '@/shared/security/sanitize'
import { utf8ByteLength } from '@/shared/validation/utf8'

import { fetchQuarantineSettings, updateQuarantineSettings } from '../../settings-api'
import {
  SETTINGS_FIELDS,
  settingsPatch,
  toSettingsForm,
  validateSettings,
  type SettingsField,
  type SettingsForm,
  type SettingsLimits,
} from '../../settings-form'
import ExcludedDomainsPicker from './ExcludedDomainsPicker.vue'

const props = withDefaults(
  defineProps<{
    settings: QuarantineSettings
    limits: SettingsLimits
    /** Whether the History link is offered (administrators). */
    history?: boolean
  }>(),
  { history: true },
)
const emit = defineEmits<{ dirty: [value: boolean]; saved: [settings: QuarantineSettings] }>()

const { t } = useI18n()
const fmt = useFormat()
const client = useQueryClient()
const translate = useClientErrors()
const uid = useId()
const step = computed(() => props.limits.maxMessageSizeStep)

const LABELS: Record<SettingsField, LegacyKey> = {
  retentionPerMailbox: 'admin.quarantine_retention_size',
  maxMessageSize: 'admin.quarantine_max_size',
  notificationScoreLimit: 'admin.quarantine_max_score',
  maxAgeDays: 'admin.quarantine_max_age',
  redirectRecipient: 'admin.quarantine_redirect',
  copyRecipient: 'admin.quarantine_bcc',
  notificationSender: 'admin.quarantine_notification_sender',
  notificationSubject: 'admin.quarantine_notification_subject',
  releaseFormat: 'admin.quarantine_release_format',
  excludedDomains: 'admin.quarantine_exclude_domains',
  notificationTemplate: 'admin.quarantine_notification_html',
}
const idOf = (field: SettingsField) => `quarantine-settings-${field}`

/** A legacy label as plain text (its markup rendered as text), for the outdated notice. */
function plainLabel(key: LegacyKey): string {
  const holder = document.createElement('template')
  holder.innerHTML = sanitizeLegacyHtml(lt(key))
  holder.content.querySelectorAll('br').forEach((br) => br.replaceWith(' '))
  return holder.content.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

// ---------------------------------------------------------------------------------------------
// State

const editing = ref(false)
const status = ref<SectionStatus | null>(null)
/** The version the form was opened with (its tag is sent); after a 412 the reloaded one. */
const base = shallowRef<QuarantineSettings>(props.settings)
/** The form as opened: the patch holds the user's changes against it. */
const opened = ref<SettingsForm>(toSettingsForm(props.settings, step.value))
const form = ref<SettingsForm>(toSettingsForm(props.settings, step.value))
const valid = reactive({
  retentionPerMailbox: true,
  maxMessageSize: true,
  notificationScoreLimit: true,
  maxAgeDays: true,
})
const outdatedFields = shallowRef<SectionChange[] | null>(null)
/** Names the server reported as no longer existing in the last save. */
const reportedMissing = ref<string[]>([])
const templateOpen = ref(false)
const pending = ref(false)

const versioned = useVersionedSave<QuarantineSettings>({
  current: () => base.value,
  refetch: async () => {
    const latest = await fetchQuarantineSettings()
    client.setQueryData(queryKeys.quarantine.settings(), latest)
    return latest
  },
})

const problemForm = useProblemForm({
  fieldId: (path) => {
    const field = path.split('.')[0] as SettingsField
    return SETTINGS_FIELDS.includes(field) ? idOf(field) : null
  },
  fieldKind: (path) => (path === 'maxMessageSize' ? 'size' : undefined),
  labelFor: (field) => (field in LABELS ? plainLabel(LABELS[field as SettingsField]) : field),
})

const missing = computed(() => [
  ...new Set([...(base.value.missingExcludedDomains ?? []), ...reportedMissing.value]),
])

/** Errors of a field, with those of its entries (`excludedDomains.2`). */
function errorsFor(field: SettingsField): string[] {
  return problemForm.summary.value
    .filter((item) => item.path === field || item.path.startsWith(`${field}.`))
    .flatMap((item) => item.messages)
}

const dirty = computed(
  () =>
    editing.value && JSON.stringify(settingsPatch(opened.value, form.value, step.value)) !== '{}',
)
watch(dirty, (value) => emit('dirty', value))

// The settings changed elsewhere while the section is closed: show them.
watch(
  () => props.settings,
  (settings) => {
    if (!editing.value) base.value = settings
  },
)

function setStatus(next: SectionStatus | null) {
  status.value = next
  if (next) announce(next.message)
}

function reset(settings: QuarantineSettings) {
  base.value = settings
  opened.value = toSettingsForm(settings, step.value)
  form.value = toSettingsForm(settings, step.value)
  Object.assign(valid, {
    retentionPerMailbox: true,
    maxMessageSize: true,
    notificationScoreLimit: true,
    maxAgeDays: true,
  })
}

function edit() {
  reset(props.settings)
  outdatedFields.value = null
  reportedMissing.value = []
  problemForm.clear()
  versioned.discard()
  setStatus(null)
  editing.value = true
}

function cancel() {
  editing.value = false
  problemForm.clear()
}

// ---------------------------------------------------------------------------------------------
// Saving

const changeValue = (field: SettingsField, settings: QuarantineSettings): string => {
  const value = settings[field as keyof QuarantineSettings]
  switch (field) {
    case 'maxMessageSize':
      return fmt.number(Math.floor(Number(value) / step.value))
    case 'notificationScoreLimit':
      return value === null || value === undefined ? '9999.0' : fmt.number(Number(value))
    case 'releaseFormat':
      return text(`enums.quarantineReleaseFormat.${String(value)}`)
    case 'excludedDomains':
      return fmt.list((value as string[] | undefined) ?? [])
    case 'notificationTemplate':
      return fmt.bytes(utf8ByteLength(String(value ?? '')))
    default:
      return value === null || value === undefined || value === '' ? '-' : String(value)
  }
}

async function showFailure(failure: ApiProblem) {
  if (failure.fieldErrors.size > 0) {
    for (const [path, violations] of failure.fieldErrors) {
      const [field, index] = path.split('.')
      if (field === 'excludedDomains' && index !== undefined) {
        const name = form.value.excludedDomains[Number(index)]
        if (name && violations.some((violation) => violation.code === 'notFound')) {
          reportedMissing.value = [...reportedMissing.value, name.toLowerCase()]
        }
      }
      if (field === 'notificationTemplate') templateOpen.value = true
    }
  }
  await problemForm.setProblem(failure)
}

async function run() {
  if (pending.value) return
  const patch = settingsPatch(opened.value, form.value, step.value)
  if (Object.keys(patch).length === 0) {
    cancel()
    return
  }
  pending.value = true
  problemForm.clear()
  setStatus(null)
  try {
    const result = await versioned.save(patch, (body, ifMatch) =>
      updateQuarantineSettings(client, body, ifMatch),
    )
    if (result.status === 'saved') {
      reset(result.result)
      outdatedFields.value = null
      editing.value = false
      setStatus({ kind: 'success', message: lt('success.saved_settings') })
      emit('saved', result.result)
    } else if (result.status === 'outdated') {
      const latest = result.latest ?? base.value
      outdatedFields.value = changedSince(base.value, latest, SETTINGS_FIELDS).map(({ field }) => ({
        field,
        label: plainLabel(LABELS[field]),
        saved: changeValue(field, latest),
      }))
    } else if (result.status === 'failed') {
      await showFailure(result.problem)
    }
  } finally {
    pending.value = false
  }
}

async function save() {
  const invalid = (Object.keys(valid) as (keyof typeof valid)[]).find((field) => !valid[field])
  if (invalid) {
    document.getElementById(idOf(invalid))?.focus()
    return
  }
  const errors = validateSettings(form.value, props.limits, {
    number: (value) => fmt.number(value),
    bytes: (value) => fmt.bytes(value, { exact: true }),
  })
  if (Object.keys(errors).length > 0) {
    if (errors.notificationTemplate) templateOpen.value = true
    await problemForm.setClientMessages(translate(errors))
    return
  }
  await run()
}

/** "Save again" after a 412: the reloaded version's tag is sent; the user's changes stay. */
async function saveAgain() {
  if (versioned.latest.value) base.value = versioned.latest.value
  outdatedFields.value = null
  await run()
}

/** "Discard my changes" after a 412: the form takes the reloaded values. */
function discard() {
  const latest = versioned.discard() ?? base.value
  reset(latest)
  outdatedFields.value = null
  problemForm.clear()
}

// ---------------------------------------------------------------------------------------------
// Display

const scorePlaceholder = computed(() =>
  fmt.number(9999, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false }),
)
const releaseFormats = computed(() =>
  props.limits.releaseFormats.map((value) => ({
    value,
    label: text(`enums.quarantineReleaseFormat.${value}`),
  })),
)
const dash = (value: string | null | undefined) => (value ? value : '-')
const templateId = `quarantine-settings-template-${uid}`
const templateLabelId = `${templateId}-label`
const templateErrors = computed(() => errorsFor('notificationTemplate'))
</script>

<template>
  <EditableSection
    section-id="quarantine-settings"
    :title="lt('admin.quarantine')"
    :editable="true"
    :editing="editing"
    :saving="pending"
    :status="status"
    :outdated="outdatedFields"
    :save-label="lt('admin.save')"
    @edit="edit"
    @cancel="cancel"
    @save="save"
    @save-again="saveAgain"
    @discard="discard"
  >
    <template #header-actions>
      <HistoryLink v-if="history" target-type="quarantineSettings" />
    </template>

    <!-- Read-only values in legacy order, with legacy's dividers. -->
    <dl data-settings-values class="flex flex-col gap-3 text-sm">
      <div data-value="retentionPerMailbox">
        <dt class="text-gray-600 dark:text-gray-400">
          <LegacyText k="admin.quarantine_retention_size" />
        </dt>
        <dd class="text-gray-900 dark:text-white">{{ fmt.number(base.retentionPerMailbox) }}</dd>
      </div>
      <div data-value="maxMessageSize">
        <dt class="text-gray-600 dark:text-gray-400">
          <LegacyText k="admin.quarantine_max_size" />
        </dt>
        <dd class="text-gray-900 dark:text-white">
          {{ fmt.number(Math.floor(base.maxMessageSize / step)) }}
        </dd>
      </div>
      <div data-value="notificationScoreLimit">
        <dt class="text-gray-600 dark:text-gray-400">
          <LegacyText k="admin.quarantine_max_score" />
        </dt>
        <dd class="text-gray-900 dark:text-white">
          {{
            base.notificationScoreLimit === null || base.notificationScoreLimit === undefined
              ? scorePlaceholder
              : fmt.number(base.notificationScoreLimit)
          }}
        </dd>
      </div>
      <div data-value="maxAgeDays">
        <dt class="text-gray-600 dark:text-gray-400">
          <LegacyText k="admin.quarantine_max_age" />
        </dt>
        <dd class="text-gray-900 dark:text-white">{{ fmt.number(base.maxAgeDays ?? 0) }}</dd>
      </div>
      <hr class="border-gray-200 dark:border-gray-800" />
      <div data-value="redirectRecipient">
        <dt class="text-gray-600 dark:text-gray-400">
          <LegacyText k="admin.quarantine_redirect" />
        </dt>
        <dd class="text-gray-900 dark:text-white">
          <PlainText :value="dash(base.redirectRecipient)" />
        </dd>
      </div>
      <div data-value="copyRecipient">
        <dt class="text-gray-600 dark:text-gray-400">
          <LegacyText k="admin.quarantine_bcc" />
        </dt>
        <dd class="text-gray-900 dark:text-white">
          <PlainText :value="dash(base.copyRecipient)" />
        </dd>
      </div>
      <hr class="border-gray-200 dark:border-gray-800" />
      <div data-value="notificationSender">
        <dt class="text-gray-600 dark:text-gray-400">
          {{ lt('admin.quarantine_notification_sender') }}
        </dt>
        <dd class="text-gray-900 dark:text-white">
          <PlainText :value="base.notificationSender" />
        </dd>
      </div>
      <div data-value="notificationSubject">
        <dt class="text-gray-600 dark:text-gray-400">
          {{ lt('admin.quarantine_notification_subject') }}
        </dt>
        <dd class="text-gray-900 dark:text-white">
          <PlainText :value="base.notificationSubject" />
        </dd>
      </div>
      <hr class="border-gray-200 dark:border-gray-800" />
      <div data-value="releaseFormat">
        <dt class="text-gray-600 dark:text-gray-400">
          {{ lt('admin.quarantine_release_format') }}
        </dt>
        <dd class="text-gray-900 dark:text-white">
          {{ text(`enums.quarantineReleaseFormat.${base.releaseFormat ?? 'original'}`) }}
        </dd>
      </div>
      <div data-value="excludedDomains">
        <dt class="text-gray-600 dark:text-gray-400">
          {{ lt('admin.quarantine_exclude_domains') }}
        </dt>
        <dd class="text-gray-900 dark:text-white">
          <span v-if="(base.excludedDomains ?? []).length === 0">-</span>
          <ul v-else class="flex flex-col gap-0.5">
            <li
              v-for="name in base.excludedDomains"
              :key="name"
              class="wrap-anywhere"
              :data-missing="missing.includes(name) ? '' : undefined"
            >
              {{ name }}
              <span
                v-if="missing.includes(name)"
                class="font-medium text-amber-800 dark:text-amber-200"
              >
                ({{ t('quarantineUi.settings.missingDomain') }})
              </span>
            </li>
          </ul>
        </dd>
      </div>
      <hr class="border-gray-200 dark:border-gray-800" />
      <div data-value="notificationTemplate" class="flex flex-col gap-2">
        <dt>
          <button
            type="button"
            :aria-expanded="templateOpen ? 'true' : 'false'"
            :aria-controls="`${templateId}-read`"
            class="flex min-h-11 w-full items-center gap-2 rounded-lg text-start text-gray-700 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300"
            data-template-toggle
            @click="templateOpen = !templateOpen"
          >
            <ChevronDownIcon
              class="size-4 shrink-0 motion-safe:transition-transform"
              :class="templateOpen ? 'rotate-180' : ''"
            />
            <LegacyText k="admin.quarantine_notification_html" />
          </button>
        </dt>
        <dd
          v-show="templateOpen"
          :id="`${templateId}-read`"
          data-template-source
          class="max-h-96 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
        >
          <PlainText :value="base.notificationTemplate" multiline />
        </dd>
      </div>
    </dl>

    <template #form>
      <ErrorSummary :id="problemForm.summaryId" :items="problemForm.summary.value" />
      <ProblemMessage :problem="problemForm.formProblem.value" />

      <LocaleNumberField
        :id="idOf('retentionPerMailbox')"
        v-model="form.retentionPerMailbox"
        :label="lt('admin.quarantine_retention_size')"
        mode="integer"
        placeholder="0"
        :errors="errorsFor('retentionPerMailbox')"
        @update:valid="valid.retentionPerMailbox = $event"
      >
        <template #label><LegacyText k="admin.quarantine_retention_size" /></template>
      </LocaleNumberField>
      <LocaleNumberField
        :id="idOf('maxMessageSize')"
        v-model="form.maxMessageSize"
        :label="lt('admin.quarantine_max_size')"
        mode="integer"
        placeholder="0"
        :errors="errorsFor('maxMessageSize')"
        @update:valid="valid.maxMessageSize = $event"
      >
        <template #label><LegacyText k="admin.quarantine_max_size" /></template>
      </LocaleNumberField>
      <LocaleNumberField
        :id="idOf('notificationScoreLimit')"
        v-model="form.notificationScoreLimit"
        :label="lt('admin.quarantine_max_score')"
        mode="decimal"
        optional
        :placeholder="scorePlaceholder"
        :errors="errorsFor('notificationScoreLimit')"
        @update:valid="valid.notificationScoreLimit = $event"
      >
        <template #label><LegacyText k="admin.quarantine_max_score" /></template>
      </LocaleNumberField>
      <LocaleNumberField
        :id="idOf('maxAgeDays')"
        v-model="form.maxAgeDays"
        :label="lt('admin.quarantine_max_age')"
        mode="integer"
        :errors="errorsFor('maxAgeDays')"
        @update:valid="valid.maxAgeDays = $event"
      >
        <template #label><LegacyText k="admin.quarantine_max_age" /></template>
      </LocaleNumberField>

      <hr class="border-gray-200 dark:border-gray-800" />

      <FormField
        v-for="field in ['redirectRecipient', 'copyRecipient'] as const"
        :id="idOf(field)"
        :key="field"
        :label="lt(LABELS[field])"
        :errors="errorsFor(field)"
      >
        <template #label><LegacyText :k="LABELS[field]" /></template>
        <template #default="control">
          <input
            v-bind="control"
            v-model="form[field]"
            type="email"
            inputmode="email"
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            class="form-control"
          />
        </template>
      </FormField>

      <hr class="border-gray-200 dark:border-gray-800" />

      <FormField
        :id="idOf('notificationSender')"
        :label="lt('admin.quarantine_notification_sender')"
        :errors="errorsFor('notificationSender')"
      >
        <template #default="control">
          <input
            v-bind="control"
            v-model="form.notificationSender"
            type="email"
            inputmode="email"
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            :placeholder="base.notificationSenderIsDefault ? base.notificationSender : undefined"
            class="form-control"
          />
        </template>
      </FormField>
      <FormField
        :id="idOf('notificationSubject')"
        :label="lt('admin.quarantine_notification_subject')"
        :errors="errorsFor('notificationSubject')"
      >
        <template #default="control">
          <input
            v-bind="control"
            v-model="form.notificationSubject"
            type="text"
            autocomplete="off"
            :placeholder="base.notificationSubjectIsDefault ? base.notificationSubject : undefined"
            class="form-control"
          />
        </template>
      </FormField>

      <hr class="border-gray-200 dark:border-gray-800" />

      <FormField
        :id="idOf('releaseFormat')"
        :label="lt('admin.quarantine_release_format')"
        :errors="errorsFor('releaseFormat')"
      >
        <template #default="control">
          <select v-bind="control" v-model="form.releaseFormat" class="form-control">
            <option v-for="option in releaseFormats" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </template>
      </FormField>
      <ExcludedDomainsPicker
        :id="idOf('excludedDomains')"
        v-model="form.excludedDomains"
        :missing="missing"
        :errors="errorsFor('excludedDomains')"
      />

      <hr class="border-gray-200 dark:border-gray-800" />

      <div class="flex flex-col gap-2" data-template-field>
        <button
          type="button"
          :aria-expanded="templateOpen ? 'true' : 'false'"
          :aria-controls="`${idOf('notificationTemplate')}-panel`"
          class="flex min-h-11 w-full items-center gap-2 rounded-lg text-start text-sm font-medium text-gray-800 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-200"
          data-template-toggle
          @click="templateOpen = !templateOpen"
        >
          <ChevronDownIcon
            class="size-4 shrink-0 motion-safe:transition-transform"
            :class="templateOpen ? 'rotate-180' : ''"
          />
          <span :id="templateLabelId"><LegacyText k="admin.quarantine_notification_html" /></span>
        </button>
        <div
          v-show="templateOpen"
          :id="`${idOf('notificationTemplate')}-panel`"
          class="flex flex-col gap-1.5"
        >
          <textarea
            :id="idOf('notificationTemplate')"
            v-model="form.notificationTemplate"
            rows="20"
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            :aria-labelledby="templateLabelId"
            :aria-invalid="templateErrors.length > 0 ? 'true' : undefined"
            :aria-describedby="
              templateErrors.length > 0 ? `${idOf('notificationTemplate')}-error` : undefined
            "
            class="form-control min-h-60 font-mono text-xs"
          />
          <div
            v-if="templateErrors.length > 0"
            :id="`${idOf('notificationTemplate')}-error`"
            class="text-sm text-red-700 dark:text-red-300"
          >
            <p v-for="(message, index) in templateErrors" :key="index" class="break-words">
              <span class="sr-only">{{ `${t('a11y.errorPrefix')} ` }}</span
              >{{ message }}
            </p>
          </div>
        </div>
      </div>
    </template>
  </EditableSection>
</template>
