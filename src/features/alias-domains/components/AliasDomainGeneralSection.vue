<script setup lang="ts">
// The "Edit Alias domain" form of the classic page (`templates/edit/aliasdomain.twig`) as one section
// with its own save (legacy form map): the target domain and active, then "Save changes"; the name
// is not editable, as in legacy. Closed, it shows the same values read-only.
// - A save sends only the changed members with the version tag read (FR-026, FR-039); legacy's
//   `success.aliasd_modified`.
// - 412: the input is kept, the alias domain reloaded and the changed values listed (FR-027).
// - 404: it no longer exists or left the scope; the page returns to the list (FR-028).
// - A new target over its alias limit says legacy's `danger.max_alias_exceeded` (US4-AS7); other
//   refusals use legacy's messages at their fields.
// - Deactivating asks nothing (legacy has no confirmation; plan part 3, item 7).
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  problemOf,
  queryKeys,
  type AliasDomain,
  type AliasDomainPatch,
  type ApiProblem,
} from '@/api'
import { YesNoMark } from '@/features/aliases-common'
import { lt } from '@/i18n'
import EditableSection from '@/shared/components/EditableSection.vue'
import type { SectionChange, SectionStatus } from '@/shared/components/editable-section'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useFormDraft } from '@/shared/composables/useFormDraft'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'

import { buildAliasDomainPatch, editFormFrom, type AliasDomainEditForm } from '../alias-domain-form'
import { fetchAliasDomain, updateAliasDomain } from '../api'
import TargetDomainField from './TargetDomainField.vue'
import TargetDomainText from './TargetDomainText.vue'

const props = withDefaults(
  defineProps<{
    aliasDomain: AliasDomain
    editing?: boolean
    editable?: boolean
    linkDomains?: boolean
  }>(),
  { editing: false, editable: true, linkDomains: false },
)
const emit = defineEmits<{ edit: []; close: []; dirty: [value: boolean]; gone: [] }>()

const ID = 'alias-domain-edit'
const TARGET_ID = `${ID}-targetDomain`

const { t } = useI18n()
const queryClient = useQueryClient()

const base = shallowRef<AliasDomain | null>(null)
const opened = shallowRef<AliasDomain>(props.aliasDomain)
const form = ref<AliasDomainEditForm>(editFormFrom(props.aliasDomain))
const labels = ref<Record<string, string>>({})
const status = ref<SectionStatus | null>(null)
const outdated = shallowRef<SectionChange[] | null>(null)
const pending = ref(false)
const sent = shallowRef<AliasDomainPatch>({})

const versioned = useVersionedSave<AliasDomain>({
  current: () => base.value,
  refetch: async () => {
    const latest = await fetchAliasDomain(props.aliasDomain.name)
    queryClient.setQueryData(queryKeys.aliasDomains.detail(latest.name), latest)
    return latest
  },
})

const problems = useProblemForm({
  formKey: 'aliasDomains.form',
  fieldId: (path) => (path === 'targetDomain' ? TARGET_ID : null),
  valueAt: (path) => (path === 'targetDomain' ? sent.value.targetDomain : undefined),
})

function open(item: AliasDomain) {
  base.value = item
  opened.value = item
  form.value = editFormFrom(item)
  labels.value = { ...labels.value, [item.targetDomain]: item.targetDomainUnicode }
  outdated.value = null
}

watch(
  () => props.editing,
  (on) => {
    if (!on) return
    open(props.aliasDomain)
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
  restore: (value: AliasDomainEditForm) => {
    if (props.editing) form.value = { ...form.value, ...value }
  },
  dirty: () => dirty.value,
})

/** The values that changed elsewhere, with their new saved values (FR-027). */
function changes(before: AliasDomain, after: AliasDomain): SectionChange[] {
  const list: SectionChange[] = []
  if (before.targetDomain !== after.targetDomain) {
    list.push({
      field: 'targetDomain',
      label: lt('edit.target_domain'),
      saved: after.targetDomainUnicode,
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
  const patch = buildAliasDomainPatch(opened.value, form.value)
  if (!patch) {
    emit('dirty', false)
    emit('close')
    return
  }
  pending.value = true
  sent.value = patch
  problems.clear()
  status.value = null
  try {
    const result = await versioned
      .save(patch, (body, ifMatch) =>
        updateAliasDomain(queryClient, props.aliasDomain.name, body, ifMatch),
      )
      // The reload after a 412 can find the alias domain gone.
      .catch((error: unknown) => ({ status: 'failed' as const, problem: problemOf(error)! }))
    if (result.status === 'saved') {
      open(result.result)
      const message = lt('success.aliasd_modified', result.result.name)
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
</script>

<template>
  <EditableSection
    section-id="general"
    :title="lt('edit.edit_alias_domain')"
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
      <dt :class="DT">{{ lt('edit.target_domain') }}</dt>
      <dd :class="DD" data-field="targetDomain">
        <TargetDomainText :alias-domain="aliasDomain" :link-domains="linkDomains" />
      </dd>
      <dt :class="DT">{{ lt('edit.active') }}</dt>
      <dd :class="DD" data-field="active"><YesNoMark :value="aliasDomain.active" /></dd>
    </dl>
    <template #form>
      <ErrorSummary :id="problems.summaryId" :items="problems.summary.value" />
      <ProblemMessage :problem="problems.formProblem.value" :retry="retryable" @retry="save" />
      <TargetDomainField
        :id="TARGET_ID"
        label-key="edit.target_domain"
        :model-value="form.targetDomain"
        :labels="labels"
        :errors="problems.errorsFor('targetDomain')"
        @pick="labels = { ...labels, [$event.name]: $event.nameUnicode }"
        @update:model-value="form.targetDomain = $event ?? form.targetDomain"
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
