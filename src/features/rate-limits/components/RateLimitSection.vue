<script setup lang="ts">
// The rate limit of a domain, alias domain or mailbox, in its legacy position on that object's page
// (legacy form map screen 6, D2, D9, D17): the domain's `#dratelimit` tab (title and label
// `edit.ratelimit`, save `admin.save`), the alias domain's form below its edit form (label
// `acl.ratelimit`, save `admin.save`) and the mailbox's `#mrl` tab (title `edit.ratelimit`, label
// `acl.ratelimit`, save `edit.save`, help `edit.mbox_rl_info`), as a section with its own save
// (conventions "Editing and conflicts"). Legacy's form: a whole number, empty for none (placeholder
// "Disabled"), and the frame. An empty value and Save removes the limit, as legacy does; both
// answer `success.rl_saved` with the object. The range and the frames come from the quarantine
// capabilities and are checked before sending. A stored value in an invalid format is shown with
// its text (D17); a mailbox shows the limit in effect and its source (D17). Without `ratelimit`
// the section is read-only with legacy's "Prohibited by ACL"; mailbox users get nothing. Saves
// carry the version tag; an outdated save keeps the input and marks the new value; a shared store
// that is down changes nothing and offers a retry with the input kept. Reached with
// `#rate-limit` from the Rate limits overview: the section scrolls itself into view once loaded.
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { problemOf, type ApiProblem, type RateLimit, type RateLimitValue } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import {
  canChangeRateLimits,
  canReadRateLimits,
  canSeeHistory,
  missingFlag,
  quarantineCapabilitiesOptions,
} from '@/features/quarantine'
import { lt, type LegacyKey } from '@/i18n'
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from '@/i18n/locales'
import AclReadOnlyNote from '@/shared/components/AclReadOnlyNote.vue'
import EditableSection from '@/shared/components/EditableSection.vue'
import type { SectionChange, SectionStatus } from '@/shared/components/editable-section'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import LegacyRateLimitField from '@/shared/components/LegacyRateLimitField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import ValueList from '@/shared/components/ValueList.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'
import { WarningIcon } from '@/shared/icons'
import { neutralise } from '@/shared/security/plain-text'

import { rateLimitOptions, removeRateLimit, setRateLimit, type RateLimitKind } from '../api'
import {
  effectiveText,
  formatLimit,
  limitMessages,
  validateLimit,
  type RateLimitFrame,
} from '../rate-limit'

const props = defineProps<{ kind: RateLimitKind; object: string }>()

const { t, locale } = useI18n()
const appLocale = computed<AppLocale>(() =>
  isAppLocale(locale.value) ? locale.value : DEFAULT_LOCALE,
)
const route = useRoute()
const client = useQueryClient()
const identityQuery = useIdentityQuery()
const identity = computed(() => identityQuery.data.value)
const readable = computed(() => canReadRateLimits(identity.value))
const changeable = computed(() => canChangeRateLimits(identity.value))
const aclFlag = computed(() => missingFlag(identity.value, 'changeRateLimits'))
const historyAllowed = computed(() => canSeeHistory(identity.value))

const query = useQuery(
  computed(() => ({
    ...rateLimitOptions(props.kind, props.object),
    enabled: readable.value,
  })),
)
const capabilities = useQuery(
  computed(() => ({ ...quarantineCapabilitiesOptions(), enabled: readable.value })),
)
const rateLimit = computed(() => query.data.value)
const caps = computed(() => capabilities.data.value?.rateLimit)

const SECTION_ID = 'rate-limit'
const title = computed(() =>
  props.kind === 'aliasDomain' ? lt('acl.ratelimit') : lt('edit.ratelimit'),
)
const labelKey = computed<LegacyKey>(() =>
  props.kind === 'domain' ? 'edit.ratelimit' : 'acl.ratelimit',
)
const saveLabel = computed(() => (props.kind === 'mailbox' ? lt('edit.save') : lt('admin.save')))

/** An API string as inert text: control and bidi characters become visible code points. */
function inert(value: string): string {
  return neutralise(value, { multiline: false })
    .map((segment) => (segment.kind === 'text' ? segment.value : segment.codePoint))
    .join('')
}

const invalidText = (value: RateLimit) =>
  value.invalidStoredValue === null
    ? null
    : t('rateLimits.invalidStoredValue', { value: inert(value.invalidStoredValue) })

/** The stored value as the read view shows it. */
const display = (value: RateLimit) =>
  value.invalidStoredValue !== null
    ? inert(value.invalidStoredValue)
    : formatLimit(value.limit, appLocale.value)

const items = computed(() =>
  rateLimit.value
    ? [{ key: 'rateLimit', label: lt(labelKey.value), value: display(rateLimit.value) }]
    : [],
)
const effective = computed(() =>
  rateLimit.value ? effectiveText(rateLimit.value, appLocale.value) : null,
)

// The form: legacy's value and frame.
interface FormValues {
  value: string
  frame: RateLimitFrame
}

const editing = ref(false)
const base = shallowRef<RateLimit | null>(null)
const opened = shallowRef<FormValues | null>(null)
const form = ref<FormValues | null>(null)
const status = ref<SectionStatus | null>(null)
const problem = shallowRef<ApiProblem | null>(null)
const outdatedChanges = shallowRef<SectionChange[] | null>(null)

const FIELD_IDS: Record<string, string> = {
  value: `${SECTION_ID}-value`,
  frame: `${SECTION_ID}-frame`,
}
const problemForm = useProblemForm({
  fieldId: (path) => FIELD_IDS[path] ?? null,
  labelFor: () => lt(labelKey.value),
  formKey: 'rateLimits.form',
  valueAt: (path) => (path === 'value' ? form.value?.value.trim() : form.value?.frame),
})
const versioned = useVersionedSave<RateLimit>({
  current: () => base.value,
  refetch: async () => (await query.refetch()).data,
})

function formFrom(value: RateLimit | null): FormValues {
  const frames = caps.value?.frames ?? []
  return {
    value: value?.limit ? String(value.limit.value) : '',
    frame: value?.limit?.frame ?? frames[0] ?? 'second',
  }
}

const normal = (values: FormValues | null) =>
  values
    ? JSON.stringify(values.value.trim() === '' ? [''] : [values.value.trim(), values.frame])
    : ''
const dirty = computed(() => editing.value && normal(form.value) !== normal(opened.value))
useLeaveGuard(dirty, { messageKey: 'leaveGuard.body' })

function clearFormState() {
  problem.value = null
  outdatedChanges.value = null
  problemForm.clear()
  versioned.discard()
}

function open() {
  if (!rateLimit.value || !caps.value) return
  base.value = rateLimit.value
  opened.value = formFrom(rateLimit.value)
  form.value = { ...opened.value }
  status.value = null
  clearFormState()
  editing.value = true
}

function close() {
  editing.value = false
  form.value = null
  clearFormState()
}

function focusHeading() {
  void nextTick(() => document.getElementById(`section-${SECTION_ID}-title`)?.focus())
}

function finish(object: string) {
  close()
  status.value = { kind: 'success', message: lt('success.rl_saved', object) }
  announce(status.value.message)
  focusHeading()
}

const sameLimit = (a: RateLimitValue | null, b: RateLimitValue | null) =>
  a === b || (!!a && !!b && a.value === b.value && a.frame === b.frame)

async function save() {
  const limits = caps.value
  const from = base.value
  if (!form.value || !limits || !from || versioned.pending.value) return
  problem.value = null
  const check = validateLimit(form.value.value, form.value.frame, limits)
  if (!check.ok) {
    await problemForm.setClientMessages(limitMessages(check.errors, appLocale.value))
    return
  }
  problemForm.clear()
  if (from.invalidStoredValue === null && sameLimit(check.limit, from.limit)) {
    finish(from.object)
    return
  }
  const result = await versioned.save(check.limit, async (limit, ifMatch) =>
    limit
      ? setRateLimit(client, props.kind, props.object, limit, ifMatch)
      : removeRateLimit(client, props.kind, props.object, ifMatch).then(() => null),
  )
  if (result.status === 'saved') finish(result.result?.object ?? from.object)
  else if (result.status === 'outdated') {
    const latest = result.latest ?? from
    outdatedChanges.value = [
      { field: 'rateLimit', label: lt(labelKey.value), saved: display(latest) },
    ]
  } else if (result.status === 'failed') {
    if (result.problem.status === 422 && result.problem.fieldErrors.size > 0) {
      await problemForm.setProblem(result.problem)
    } else problem.value = result.problem
  }
}

/** "Save again": the user's input over the value saved in the meantime. */
async function saveAgain() {
  const latest = versioned.latest.value
  if (latest) base.value = latest
  outdatedChanges.value = null
  await save()
}

/** "Discard my changes": the value saved in the meantime. */
function discard() {
  const latest = versioned.discard() ?? base.value
  outdatedChanges.value = null
  if (!latest) return
  base.value = latest
  opened.value = formFrom(latest)
  form.value = { ...opened.value }
}

const editable = computed(
  () => changeable.value && !!rateLimit.value && !!caps.value && !query.isError.value,
)
const loadFailed = computed(() => query.isError.value && !rateLimit.value)

// Reached with `#rate-limit` (the Rate limits overview): the section loads after the page, so it
// scrolls itself into view and takes the focus once its value is known.
let arrived = false
watch(
  () => [route?.hash, !!rateLimit.value] as const,
  ([hash, loaded]) => {
    if (arrived || !loaded || hash !== `#${SECTION_ID}`) return
    arrived = true
    void nextTick(() => {
      document.getElementById(SECTION_ID)?.scrollIntoView({ block: 'start' })
      focusHeading()
    })
  },
  { immediate: true },
)

/** A temporary failure or a lost answer: nothing was changed, so the same input can be sent again. */
const retryable = computed(
  () => !!problem.value && (problem.value.status === 503 || problem.value.kind === 'network'),
)
</script>

<template>
  <div v-if="readable" :id="SECTION_ID" data-rate-limit-section class="scroll-mt-20">
    <EditableSection
      :section-id="SECTION_ID"
      :title="title"
      :editable="editable"
      :editing="editing"
      :saving="versioned.pending.value"
      :status="status"
      :outdated="outdatedChanges"
      :save-label="saveLabel"
      @edit="open"
      @cancel="close"
      @save="save"
      @save-again="saveAgain"
      @discard="discard"
    >
      <template #header-actions>
        <HistoryLink
          v-if="!editing"
          :target-id="object"
          target-type="rateLimit"
          :allowed="historyAllowed"
        />
      </template>
      <div class="flex flex-col gap-3">
        <p v-if="query.isPending.value" class="text-sm text-gray-600 dark:text-gray-400">
          {{ lt('datatables.loadingRecords') }}
        </p>
        <div v-else-if="loadFailed" class="flex flex-col gap-2">
          <p role="alert" class="font-medium text-gray-900 dark:text-white">
            {{ t('states.detail.error') }}
          </p>
          <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="query.refetch()" />
        </div>
        <template v-else-if="rateLimit">
          <ValueList :items="items" />
          <p
            v-if="invalidText(rateLimit)"
            data-invalid-stored
            class="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm break-words text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
          >
            <WarningIcon class="mt-0.5 size-4 shrink-0" />
            <span class="min-w-0">{{ invalidText(rateLimit) }}</span>
          </p>
          <p v-if="effective" data-effective class="text-gray-900 dark:text-white">
            {{ effective }}
          </p>
          <AclReadOnlyNote
            v-if="!changeable && aclFlag"
            :id="`${SECTION_ID}-acl`"
            :flag="aclFlag"
          />
          <LegacyText
            v-if="kind === 'mailbox'"
            k="edit.mbox_rl_info"
            as="p"
            class="text-sm text-gray-600 dark:text-gray-400"
          />
        </template>
      </div>
      <template #form>
        <template v-if="form && caps">
          <ErrorSummary :id="problemForm.summaryId" :items="problemForm.summary.value" />
          <ProblemMessage v-if="problem" :problem="problem" :retry="retryable" @retry="save" />
          <ProblemMessage
            v-else-if="problemForm.formProblem.value"
            :problem="problemForm.formProblem.value"
          />
          <p
            v-if="base && invalidText(base)"
            class="text-sm break-words text-amber-900 dark:text-amber-100"
          >
            {{ invalidText(base) }}
          </p>
          <LegacyRateLimitField
            :id-prefix="SECTION_ID"
            :value="form.value"
            :frame="form.frame"
            :frames="caps.frames"
            :label-key="labelKey"
            :errors="[...problemForm.errorsFor('value'), ...problemForm.errorsFor('frame')]"
            @update:value="form.value = $event"
            @update:frame="form.frame = $event"
          />
          <LegacyText
            v-if="kind === 'mailbox'"
            k="edit.mbox_rl_info"
            as="p"
            class="text-sm text-gray-600 dark:text-gray-400"
          />
        </template>
      </template>
    </EditableSection>
  </div>
</template>
