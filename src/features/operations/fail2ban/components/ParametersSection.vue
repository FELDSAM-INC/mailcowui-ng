<script setup lang="ts">
// The Fail2ban parameters (FR-067 to FR-069, FR-072, plan decisions 1, 4 and 13): legacy's one form
// (`templates/admin/tab-config-f2b.twig`, `data-id="f2b"`) as one section with its own Edit and
// Save, in legacy order and with legacy's controls: the ban time, the maximum ban time and the
// retry window in seconds, the increment checkbox, the attempts, the IPv4 and IPv6 subnet sizes,
// "Manage Fail2Ban externally" with its explanation, the list explanation, and the allowlist and
// the denylist with one entry per line. The client checks the contract's rules before sending;
// saving sends only the changed values with the version tag that was read; an outdated save keeps
// the input, reloads and marks the values changed meanwhile; refused list entries are named with
// their line. Saving a denylist entry that newly covers the caller's own address asks first.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ApiProblem, Fail2BanSettings, MonitoringCapabilities } from '@/api'
import { lt, type LegacyKey } from '@/i18n'
import { useFormat } from '@/i18n/format'
import { useProblemMessages } from '@/i18n/problems'
import EditableSection from '@/shared/components/EditableSection.vue'
import type { SectionChange, SectionStatus } from '@/shared/components/editable-section'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { confirm } from '@/shared/composables/useConfirm'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { changedSince, useVersionedSave } from '@/shared/composables/useVersionedSave'
import { WarningIcon } from '@/shared/icons'

import { fetchSettings, updateSettings, writeSettings } from '../api'
import { coversAddress } from '../covers-address'
import { checkLists, parseEntries, type ListError, type ListName } from '../list-entries'
import {
  NUMBER_FIELDS,
  parametersPatch,
  toParametersForm,
  validateParameters,
  type FieldError,
  type NumberField,
  type ParametersForm,
} from '../parameters'

const props = withDefaults(
  defineProps<{
    settings: Fail2BanSettings
    capabilities: MonitoringCapabilities | null
    editing: boolean
  }>(),
  {},
)
const emit = defineEmits<{ edit: []; close: []; dirty: [dirty: boolean] }>()

const { t } = useI18n()
const fmt = useFormat()
const client = useQueryClient()
const { violationMessage } = useProblemMessages()

const LABELS: Record<
  NumberField | ListName | 'banTimeIncrement' | 'externallyEnforced',
  LegacyKey
> = {
  banTime: 'admin.f2b_ban_time',
  maxBanTime: 'admin.f2b_max_ban_time',
  banTimeIncrement: 'admin.f2b_ban_time_increment',
  maxAttempts: 'admin.f2b_max_attempts',
  retryWindow: 'admin.f2b_retry_window',
  ipv4PrefixLength: 'admin.f2b_netban_ipv4',
  ipv6PrefixLength: 'admin.f2b_netban_ipv6',
  externallyEnforced: 'admin.f2b_manage_external',
  allowlist: 'admin.f2b_whitelist',
  denylist: 'admin.f2b_blacklist',
}
const fieldId = (field: string) => `f2b-${field}`

/** The version the form was opened with: the patch holds the user's changes against it. */
const base = shallowRef<Fail2BanSettings>(props.settings)
/** The version whose tag is sent: the reloaded one after an outdated save. */
const current = shallowRef<Fail2BanSettings>(props.settings)
const form = ref<ParametersForm>(toParametersForm(props.settings))
const status = ref<SectionStatus | null>(null)
const outdated = shallowRef<SectionChange[] | null>(null)
const notRecorded = ref(false)

const versioned = useVersionedSave<Fail2BanSettings>({
  current: () => current.value,
  refetch: async () => {
    const latest = await fetchSettings()
    writeSettings(client, latest)
    return latest
  },
})
const problems = useProblemForm({
  fieldId: (path) => {
    const field = path.split('.')[0] ?? ''
    return field in LABELS ? fieldId(field) : null
  },
})

watch(
  () => props.editing,
  (open) => {
    if (!open) return
    base.value = props.settings
    current.value = props.settings
    form.value = toParametersForm(props.settings)
    outdated.value = null
    problems.clear()
  },
)

const dirty = computed(
  () =>
    props.editing && JSON.stringify(form.value) !== JSON.stringify(toParametersForm(base.value)),
)
watch(dirty, (value) => emit('dirty', value), { immediate: true })

// Messages

function numberMessage(error: FieldError): string {
  switch (error.code) {
    case 'required':
      return t('validation.required')
    case 'invalid':
      return t('validation.invalid')
    case 'outOfRange':
      return t('validation.outOfRange', { min: fmt.number(error.min), max: fmt.number(error.max) })
    case 'outOfRangeMinField':
      return t('validation.outOfRangeMinField', {
        min: fmt.number(error.min),
        field: lt(LABELS.banTime),
        max: fmt.number(error.max),
      })
  }
}

function otherList(list: ListName): ListName {
  return list === 'allowlist' ? 'denylist' : 'allowlist'
}

function listEntryMessage(list: ListName, code: string, entry: string, max?: unknown): string {
  switch (code) {
    case 'invalidFormat':
    case 'reserved':
      return lt('danger.network_host_invalid', entry)
    case 'conflictsWith':
      return t('validation.conflictsWith', { field: lt(LABELS[otherList(list)]) })
    case 'tooLong':
      return t('validation.tooLong', { max: fmt.number(Number(max ?? 253)) })
    default:
      return t('validation.invalid')
  }
}

function withLine(line: number | null, message: string): string {
  return line === null ? message : `${t('operations.fail2ban.line', { line })}: ${message}`
}

function clientListMessages(errors: ListError[]): Record<string, string[]> {
  const messages: Record<string, string[]> = {}
  const max = props.capabilities?.limits.fail2banListMaxEntries
  for (const error of errors) {
    const text =
      error.code === 'tooMany'
        ? t('validation.tooMany', { max: fmt.number(max ?? 0) })
        : listEntryMessage(error.list, error.code, error.entry ?? '')
    ;(messages[error.list] ??= []).push(withLine(error.line, text))
  }
  return messages
}

/** The API's field errors as messages, list entries named by their line. */
function serverMessages(problem: ApiProblem): Record<string, string[]> {
  const lists = {
    allowlist: parseEntries(form.value.allowlist),
    denylist: parseEntries(form.value.denylist),
  }
  const messages: Record<string, string[]> = {}
  for (const [path, violations] of problem.fieldErrors) {
    const [field, index] = path.split('.') as [string, string | undefined]
    for (const violation of violations) {
      const params = (violation.params ?? {}) as Record<string, unknown>
      let text: string
      if ((field === 'allowlist' || field === 'denylist') && index !== undefined) {
        const at = Number(index)
        const entry = lists[field].entries[at] ?? ''
        text = withLine(
          lists[field].lineOf[at] ?? null,
          listEntryMessage(field, String(violation.code), entry, params.max),
        )
      } else if (violation.code === 'outOfRange' && params.minField === 'banTime') {
        text = numberMessage({
          code: 'outOfRangeMinField',
          min: Number(params.min),
          max: Number(params.max),
        })
      } else if (violation.code === 'mustNotExceed') {
        text = t('validation.mustNotExceed', {
          field: lt(LABELS.maxBanTime),
          value: fmt.number(Number(params.value)),
        })
      } else {
        text = violationMessage(violation)
      }
      ;(messages[field] ??= []).push(text)
    }
  }
  return messages
}

// Saving

function clientErrors(): Record<string, string[]> {
  const messages: Record<string, string[]> = {}
  const numbers = validateParameters(base.value, form.value)
  for (const field of NUMBER_FIELDS) {
    const errors = numbers[field]
    if (errors) messages[field] = errors.map(numberMessage)
  }
  const allow = parseEntries(form.value.allowlist)
  const deny = parseEntries(form.value.denylist)
  const changedLists =
    form.value.allowlist !== toParametersForm(base.value).allowlist ||
    form.value.denylist !== toParametersForm(base.value).denylist
  if (changedLists) {
    const max = props.capabilities?.limits.fail2banListMaxEntries ?? null
    Object.assign(messages, clientListMessages(checkLists(allow, deny, { maxEntries: max })))
  }
  return messages
}

/** Denylist entries added now that cover the caller's own address (FR-069). */
function newlyCovering(): string[] {
  const address = props.capabilities?.clientAddress
  if (!address) return []
  const before = new Set(base.value.denylist)
  return parseEntries(form.value.denylist).entries.filter(
    (entry) => !before.has(entry) && coversAddress(entry, address),
  )
}

async function send(confirmCovering: boolean) {
  status.value = null
  notRecorded.value = false
  const errors = clientErrors()
  if (Object.keys(errors).length > 0) {
    await problems.setClientMessages(errors)
    return
  }
  if (confirmCovering && newlyCovering().length > 0) {
    const ok = await confirm({
      title: lt('admin.ays'),
      description: t('operations.fail2ban.ownAddress', {
        address: props.capabilities?.clientAddress ?? '',
      }),
      confirmLabel: lt('admin.save'),
      destructive: true,
    })
    if (!ok) return
  }
  const patch = parametersPatch(base.value, form.value)
  if (Object.keys(patch).length === 0) {
    emit('close')
    return
  }
  problems.clear()
  const result = await versioned.save(patch, (body, ifMatch) => updateSettings(body, ifMatch))
  if (result.status === 'saved') {
    const saved = result.result.result
    writeSettings(client, saved)
    if (patch.denylist || patch.allowlist) {
      void client.invalidateQueries({ queryKey: ['fail2ban', 'permanent-bans'] })
    }
    notRecorded.value = !result.result.auditRecorded
    base.value = saved
    current.value = saved
    outdated.value = null
    status.value = { kind: 'success', message: lt('success.f2b_modified') }
    announce(status.value.message)
    emit('close')
  } else if (result.status === 'outdated') {
    const latest = result.latest
    if (!latest) return
    current.value = latest
    const fields = [
      ...NUMBER_FIELDS,
      'banTimeIncrement',
      'externallyEnforced',
      'allowlist',
      'denylist',
    ] as const
    outdated.value = changedSince(base.value, latest, fields).map(({ field, savedValue }) => ({
      field,
      label: lt(LABELS[field]),
      saved: Array.isArray(savedValue)
        ? savedValue.join(', ')
        : typeof savedValue === 'boolean'
          ? lt(savedValue ? 'mailbox.yes' : 'mailbox.no')
          : String(savedValue),
    }))
  } else if (result.status === 'failed') {
    if (result.problem.fieldErrors.size > 0) {
      await problems.setClientMessages(serverMessages(result.problem))
    } else {
      await problems.setProblem(result.problem)
    }
  }
}

function save() {
  void send(true)
}

function saveAgain() {
  void send(true)
}

function discard() {
  const latest = versioned.discard() ?? current.value
  base.value = latest
  current.value = latest
  form.value = toParametersForm(latest)
  outdated.value = null
  problems.clear()
}

function cancel() {
  form.value = toParametersForm(base.value)
  outdated.value = null
  problems.clear()
  emit('close')
}

const readNumbers = computed(() =>
  NUMBER_FIELDS.map((field) => ({
    field,
    label: LABELS[field],
    value:
      field === 'ipv4PrefixLength' || field === 'ipv6PrefixLength'
        ? `/${props.settings[field]}`
        : fmt.number(props.settings[field]),
  })),
)

const textareaClass =
  'w-full min-w-0 rounded-[10px] border border-gray-300 bg-white px-4 py-2 font-mono text-sm text-gray-800 shadow-theme-xs outline-hidden focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 aria-invalid:border-red-600 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90'
</script>

<template>
  <EditableSection
    section-id="parameters"
    :title="lt('admin.f2b_parameters')"
    editable
    :editing="editing"
    :saving="versioned.pending.value"
    :status="status"
    :outdated="outdated"
    :save-label="lt('admin.save')"
    @edit="emit('edit')"
    @cancel="cancel"
    @save="save"
    @save-again="saveAgain"
    @discard="discard"
  >
    <template #header-actions>
      <!-- The orchestrator places "Restart netfilter" (`header.restart_netfilter`) here, beside
           the form's actions, as legacy places it beside Save (plan decision 13). -->
      <slot name="restart" />
      <HistoryLink target-type="fail2banSettings" />
    </template>

    <dl
      data-parameters
      class="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <template v-for="item in readNumbers" :key="item.field">
        <dt class="text-gray-600 dark:text-gray-400">{{ lt(item.label) }}</dt>
        <dd :data-value="item.field" class="text-gray-900 dark:text-white">{{ item.value }}</dd>
        <template v-if="item.field === 'maxBanTime'">
          <dt class="text-gray-600 dark:text-gray-400">{{ lt(LABELS.banTimeIncrement) }}</dt>
          <dd data-value="banTimeIncrement" class="text-gray-900 dark:text-white">
            <LegacyText :k="settings.banTimeIncrement ? 'mailbox.yes' : 'mailbox.no'" />
          </dd>
        </template>
      </template>
      <dt class="text-gray-600 dark:text-gray-400">{{ lt(LABELS.externallyEnforced) }}</dt>
      <dd data-value="externallyEnforced" class="text-gray-900 dark:text-white">
        <LegacyText :k="settings.externallyEnforced ? 'mailbox.yes' : 'mailbox.no'" />
      </dd>
    </dl>
    <LegacyText
      k="admin.f2b_list_info"
      as="p"
      class="mt-4 text-sm text-gray-600 dark:text-gray-400"
    />
    <dl class="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
      <div v-for="list in ['allowlist', 'denylist'] as const" :key="list" class="min-w-0">
        <dt class="text-gray-600 dark:text-gray-400">{{ lt(LABELS[list]) }}</dt>
        <dd :data-value="list" class="text-gray-900 dark:text-white">
          <ul v-if="settings[list].length > 0" class="font-mono">
            <li v-for="entry in settings[list]" :key="entry" class="wrap-anywhere">{{ entry }}</li>
          </ul>
          <template v-else>-</template>
        </dd>
      </div>
    </dl>
    <p
      v-if="notRecorded"
      data-not-recorded
      role="status"
      class="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      <WarningIcon class="mt-0.5 size-4 shrink-0" />{{ t('operations.notRecorded') }}
    </p>

    <template #form>
      <ErrorSummary :id="problems.summaryId" :items="problems.summary.value" />
      <ProblemMessage :problem="problems.formProblem.value" />
      <template v-for="field in NUMBER_FIELDS" :key="field">
        <FormField
          :id="fieldId(field)"
          :label="lt(LABELS[field])"
          :errors="problems.errorsFor(field)"
        >
          <template #default="control">
            <div
              v-if="field === 'ipv4PrefixLength' || field === 'ipv6PrefixLength'"
              class="flex items-stretch"
            >
              <span
                aria-hidden="true"
                class="inline-flex items-center rounded-s-[10px] border border-e-0 border-gray-300 bg-gray-50 px-3 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >/</span
              >
              <input
                v-bind="control"
                v-model="form[field]"
                type="text"
                inputmode="numeric"
                autocomplete="off"
                class="form-control rounded-s-none"
              />
            </div>
            <input
              v-else
              v-bind="control"
              v-model="form[field]"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              class="form-control"
            />
          </template>
        </FormField>
        <label
          v-if="field === 'maxBanTime'"
          :for="fieldId('banTimeIncrement')"
          class="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-gray-800 dark:text-gray-200"
        >
          <input
            :id="fieldId('banTimeIncrement')"
            v-model="form.banTimeIncrement"
            type="checkbox"
            class="size-5 shrink-0 accent-brand-500"
          />
          <span>{{ lt(LABELS.banTimeIncrement) }}</span>
        </label>
      </template>
      <div class="flex flex-col gap-1">
        <label
          :for="fieldId('externallyEnforced')"
          class="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-gray-800 dark:text-gray-200"
        >
          <input
            :id="fieldId('externallyEnforced')"
            v-model="form.externallyEnforced"
            type="checkbox"
            role="switch"
            :aria-describedby="`${fieldId('externallyEnforced')}-info`"
            class="size-5 shrink-0 accent-brand-500"
          />
          <span>{{ lt(LABELS.externallyEnforced) }}</span>
        </label>
        <LegacyText
          :id="`${fieldId('externallyEnforced')}-info`"
          k="admin.f2b_manage_external_info"
          as="p"
          class="text-sm text-gray-600 dark:text-gray-400"
        />
      </div>
      <hr class="border-gray-200 dark:border-gray-800" />
      <LegacyText k="admin.f2b_list_info" as="p" class="text-sm text-gray-600 dark:text-gray-400" />
      <FormField
        v-for="list in ['allowlist', 'denylist'] as const"
        :id="fieldId(list)"
        :key="list"
        :label="lt(LABELS[list])"
        :errors="problems.errorsFor(list)"
      >
        <template #default="control">
          <textarea
            v-bind="control"
            v-model="form[list]"
            rows="5"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            :class="textareaClass"
          />
        </template>
      </FormField>
    </template>
  </EditableSection>
</template>
