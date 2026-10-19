<script setup lang="ts">
// The "Resource" form of the classic page (`templates/edit/resource.twig`) as one section with its
// own save (legacy form map): description, kind, multiple bookings (select and number), active,
// then "Save changes", with the note that the address stays the same (US7-AS6). Closed, it shows
// the same values read-only.
// - A save sends only the changed members, the booking limit only for a hard limit, with the
//   version read (FR-026, FR-046); legacy's `success.resource_modified` (its own text).
// - 412: the input is kept, the resource reloaded and the changed values listed (FR-027).
// - 404: it no longer exists or left the scope; the page returns to the list (FR-028).
// - Deactivating asks nothing (legacy has no confirmation; plan part 3, item 7).
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  problemOf,
  queryKeys,
  type AliasCapabilities,
  type ApiProblem,
  type Resource,
  type ResourcePatch,
} from '@/api'
import { YesNoMark } from '@/features/aliases-common'
import { lt } from '@/i18n'
import EditableSection from '@/shared/components/EditableSection.vue'
import type { SectionChange, SectionStatus } from '@/shared/components/editable-section'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useFormDraft } from '@/shared/composables/useFormDraft'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'

import { fetchResource, updateResource } from '../api'
import { bookingBadge, checkBookingLimit } from '../booking'
import { buildResourcePatch, editFormFrom, type ResourceEditForm } from '../resource-form'
import BookingRuleBadge from './BookingRuleBadge.vue'
import BookingRuleField from './BookingRuleField.vue'
import KindSelect from './KindSelect.vue'

const props = withDefaults(
  defineProps<{
    resource: Resource
    editing?: boolean
    editable?: boolean
    capabilities?: AliasCapabilities
  }>(),
  { editing: false, editable: true, capabilities: undefined },
)
const emit = defineEmits<{ edit: []; close: []; dirty: [value: boolean]; gone: [] }>()

const ID = 'resource-edit'
const { t } = useI18n()
const queryClient = useQueryClient()

const base = shallowRef<Resource | null>(null)
const opened = shallowRef<Resource>(props.resource)
const form = ref<ResourceEditForm>(editFormFrom(props.resource))
const status = ref<SectionStatus | null>(null)
const outdated = shallowRef<SectionChange[] | null>(null)
const pending = ref(false)

const range = computed(
  () => props.capabilities?.resourceBookingLimit ?? { min: 1, max: 2147483647 },
)

const versioned = useVersionedSave<Resource>({
  current: () => base.value,
  refetch: async () => {
    const latest = await fetchResource(props.resource.address)
    queryClient.setQueryData(queryKeys.resources.detail(latest.address), latest)
    return latest
  },
})

const problems = useProblemForm({
  formKey: 'resources.form',
  fieldId: (path) => {
    if (path === 'description') return `${ID}-description`
    if (path === 'kind') return `${ID}-kind`
    if (path === 'bookingRule') return `${ID}-bookingRule`
    if (path === 'bookingLimit') return `${ID}-bookingLimit`
    return null
  },
  valueAt: (path) => (path === 'description' ? form.value.description : undefined),
})

function open(item: Resource) {
  base.value = item
  opened.value = item
  form.value = editFormFrom(item)
  outdated.value = null
}

watch(
  () => props.editing,
  (on) => {
    if (!on) return
    open(props.resource)
    status.value = null
    problems.clear()
    versioned.discard()
  },
  { immediate: true },
)

const dirty = computed(
  () => props.editing && JSON.stringify(form.value) !== JSON.stringify(editFormFrom(opened.value)),
)
watch(dirty, (value) => emit('dirty', value), { immediate: true })

const draft = useFormDraft(ID, {
  capture: () => ({ ...form.value }),
  restore: (value: ResourceEditForm) => {
    if (props.editing) form.value = { ...form.value, ...value }
  },
  dirty: () => dirty.value,
})

function check(): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  const description = form.value.description.trim()
  const max = props.capabilities?.resourceDescriptionMaxLength
  if (description === '') errors.description = [t('validation.required')]
  else if (max !== undefined && [...description].length > max) {
    errors.description = [t('validation.tooLong', { max })]
  }
  if (form.value.bookingRule === 'limited') {
    const wrong = checkBookingLimit(form.value.bookingLimitText, range.value)
    if (wrong) errors.bookingLimit = [t('validation.outOfRange', wrong)]
  }
  return errors
}

function changes(before: Resource, after: Resource): SectionChange[] {
  const list: SectionChange[] = []
  if (before.description !== after.description) {
    list.push({ field: 'description', label: lt('add.description'), saved: after.description })
  }
  if (before.kind !== after.kind) {
    list.push({
      field: 'kind',
      label: lt('edit.kind'),
      saved: t(`enums.resourceKind.${after.kind}`),
    })
  }
  if (before.bookingRule !== after.bookingRule || before.bookingLimit !== after.bookingLimit) {
    list.push({
      field: 'bookingRule',
      label: lt('add.multiple_bookings'),
      saved: bookingBadge(after),
    })
  }
  if (before.active !== after.active) {
    list.push({
      field: 'active',
      label: lt('edit.active'),
      saved: after.active ? t('lists.filters.yes') : t('lists.filters.no'),
    })
  }
  return list
}

async function showFailure(problem: ApiProblem) {
  if (problem.status === 404) {
    draft.clear()
    emit('dirty', false)
    emit('gone')
    return
  }
  await problems.setProblem(problem)
}

async function save() {
  if (!base.value || pending.value) return
  const errors = check()
  if (Object.keys(errors).length > 0) {
    await problems.setClientMessages(errors)
    return
  }
  const patch: ResourcePatch | null = buildResourcePatch(opened.value, form.value)
  if (!patch) {
    emit('dirty', false)
    emit('close')
    return
  }
  pending.value = true
  problems.clear()
  status.value = null
  try {
    const result = await versioned
      .save(patch, (body, ifMatch) =>
        updateResource(queryClient, props.resource.address, body, ifMatch),
      )
      // The reload after a 412 can find the resource gone.
      .catch((error: unknown) => ({ status: 'failed' as const, problem: problemOf(error)! }))
    if (result.status === 'saved') {
      open(result.result)
      const message = lt('success.resource_modified', result.result.address)
      status.value = { kind: 'success', message }
      announce(message)
      draft.clear()
      emit('dirty', false)
      emit('close')
      return
    }
    if (result.status === 'outdated') {
      outdated.value = changes(base.value, result.latest ?? base.value)
      return
    }
    if (result.status === 'failed') await showFailure(result.problem)
  } finally {
    pending.value = false
  }
}

async function saveAgain() {
  const latest = versioned.latest.value
  if (latest) base.value = latest
  outdated.value = null
  await save()
}

function discard() {
  const latest = versioned.discard() ?? base.value
  if (latest) open(latest)
  problems.clear()
}

const retryable = computed(() => problems.formProblem.value?.kind === 'network')
const DT = 'text-sm text-gray-600 dark:text-gray-400'
const DD = 'min-w-0 break-words text-gray-900 dark:text-white'
const INPUT =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white'
</script>

<template>
  <EditableSection
    section-id="resource"
    :title="lt('edit.resource')"
    :editable="editable"
    :editing="editing"
    :saving="pending"
    :status="status"
    :outdated="outdated"
    :save-label="lt('edit.save')"
    @edit="emit('edit')"
    @cancel="emit('close')"
    @save="save"
    @save-again="saveAgain"
    @discard="discard"
  >
    <dl class="grid grid-cols-1 gap-3 md:grid-cols-[minmax(10rem,auto)_1fr] md:gap-x-6">
      <dt :class="DT">{{ lt('add.description') }}</dt>
      <dd :class="DD" data-field="description">{{ resource.description }}</dd>
      <dt :class="DT">{{ lt('edit.kind') }}</dt>
      <dd :class="DD" data-field="kind">{{ t(`enums.resourceKind.${resource.kind}`) }}</dd>
      <dt :class="DT">{{ lt('add.multiple_bookings') }}</dt>
      <dd :class="DD" data-field="bookingRule"><BookingRuleBadge :resource="resource" /></dd>
      <dt :class="DT">{{ lt('edit.active') }}</dt>
      <dd :class="DD" data-field="active"><YesNoMark :value="resource.active" /></dd>
    </dl>
    <template #form>
      <ErrorSummary :id="problems.summaryId" :items="problems.summary.value" />
      <ProblemMessage :problem="problems.formProblem.value" :retry="retryable" @retry="save" />
      <FormField
        :id="`${ID}-description`"
        :label="lt('add.description')"
        :errors="problems.errorsFor('description')"
      >
        <template #default="control">
          <input
            v-bind="control"
            v-model="form.description"
            type="text"
            autocomplete="off"
            :aria-describedby="
              [control['aria-describedby'], `${ID}-addressKept`].filter(Boolean).join(' ')
            "
            :class="INPUT"
          />
        </template>
      </FormField>
      <p :id="`${ID}-addressKept`" class="-mt-2 text-sm text-gray-600 dark:text-gray-400">
        {{ t('resources.form.addressKept') }}
      </p>
      <KindSelect
        :id="`${ID}-kind`"
        label-key="edit.kind"
        :model-value="form.kind"
        :errors="problems.errorsFor('kind')"
        @update:model-value="form.kind = $event"
      />
      <BookingRuleField
        :id-prefix="ID"
        :rule="form.bookingRule"
        :limit-text="form.bookingLimitText"
        :range="range"
        :errors="problems.errorsFor('bookingRule')"
        :limit-errors="problems.errorsFor('bookingLimit')"
        @update:rule="form.bookingRule = $event"
        @update:limit-text="form.bookingLimitText = $event"
      />
      <label class="inline-flex min-h-11 items-center gap-3 text-gray-800 dark:text-gray-200">
        <input
          :id="`${ID}-active`"
          v-model="form.active"
          type="checkbox"
          class="size-5 accent-brand-500"
        />
        {{ lt('edit.active') }}
      </label>
    </template>
  </EditableSection>
</template>
