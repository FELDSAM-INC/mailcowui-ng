<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, toRaw, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { problemOf, queryKeys } from '@/api'
import { lt } from '@/i18n'
import { syncFieldLabels } from '../sync-field-labels'
import EditableSection from '@/shared/components/EditableSection.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { confirm } from '@/shared/composables/useConfirm'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'
import { Badge } from '@/shared/ui/badge'
import { buttonVariants } from '@/shared/ui/button'
import {
  identitySyncKey,
  synchronisationOptions,
  updateSynchronisation,
  requestSyncRun,
  type IdentitySyncSettings,
  type IdentitySyncStatus,
  type IdentitySyncRun,
} from '../synchronisation-api'
import IdentitySyncRuns from './IdentitySyncRuns.vue'
import IdentitySyncFields from './IdentitySyncFields.vue'
import { syncSections, syncSectionTitle } from '../sync-form'
import IdentityLinkSection from './IdentityLinkSection.vue'

const props = defineProps<{ providerEditing?: boolean }>()
const emit = defineEmits<{ dirty: [value: boolean]; editing: [value: boolean] }>()
const { t } = useI18n()
const client = useQueryClient()
const query = useQuery(synchronisationOptions())
const stored = computed(() => query.data.value)
const base = shallowRef<IdentitySyncStatus>()
const original = shallowRef<IdentitySyncSettings>()
const activeSection = ref('')
const form = ref<IdentitySyncSettings>()
const editing = computed(() => !!form.value)
const dirty = computed(
  () => !!form.value && JSON.stringify(form.value) !== JSON.stringify(original.value),
)
const errors = useProblemForm({ fieldId: (path) => `identity-sync-${path.split('.')[0]}` })
const saveState = useVersionedSave({
  current: () => base.value,
  refetch: async () => (await query.refetch()).data,
})
const busy = ref(false)
const runProblem = shallowRef<ReturnType<typeof problemOf>>(null)
const message = ref('')
const sections = computed(() => syncSections(stored.value?.provider))
const shownFields = computed(
  () => sections.value.find((section) => section.id === activeSection.value)?.fields ?? [],
)
watch(editing, (value) => emit('editing', value), { immediate: true })
watch(dirty, (value) => emit('dirty', value), { immediate: true })
onBeforeUnmount(() => {
  emit('dirty', false)
  emit('editing', false)
})
function open(section = activeSection.value) {
  if (!stored.value || props.providerEditing) return
  activeSection.value = section
  errors.clear()
  base.value = stored.value
  original.value = structuredClone(toRaw(stored.value.settings))
  form.value = structuredClone(toRaw(stored.value.settings))
  saveState.discard()
}
async function close() {
  if (
    dirty.value &&
    !(await confirm({
      title: t('leaveGuard.title'),
      description: t('leaveGuard.body'),
      confirmLabel: t('leaveGuard.leave'),
      cancelLabel: t('leaveGuard.stay'),
      destructive: true,
    }))
  )
    return
  form.value = undefined
  saveState.discard()
}
function patch(): Partial<IdentitySyncSettings> {
  return Object.fromEntries(
    shownFields.value
      .filter((key) => JSON.stringify(form.value?.[key]) !== JSON.stringify(original.value?.[key]))
      .map((key) => [key, form.value![key]]),
  )
}
async function save() {
  if (!form.value || !base.value || saveState.pending.value) return
  if (!dirty.value) {
    form.value = undefined
    return
  }
  if (
    activeSection.value === 'directory' &&
    form.value.idAttribute !== original.value?.idAttribute &&
    !(await confirm({
      title: t('identitySync.idChangeTitle'),
      description: t('identitySync.idChangeBody'),
      confirmLabel: lt('admin.save'),
      destructive: true,
    }))
  )
    return
  errors.clear()
  const result = await saveState.save(patch(), updateSynchronisation)
  if (result.status === 'saved') {
    client.setQueryData(identitySyncKey, result.result)
    await client.invalidateQueries({ queryKey: queryKeys.identityProvider.configuration() })
    await client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
    form.value = undefined
  } else if (result.status === 'outdated' && result.latest) {
    base.value = result.latest
  } else if (result.status === 'failed') await errors.setProblem(result.problem)
}
async function run(mode: IdentitySyncRun['mode']) {
  if (busy.value) return
  if (
    mode !== 'preview' &&
    !(await confirm({
      title: t(`identitySync.actions.${mode}`),
      description: t(`identitySync.${mode}Confirmation`),
      confirmLabel: t(`identitySync.actions.${mode}`),
      destructive: mode === 'force',
      ...(mode === 'force' ? { acknowledge: { label: t('identitySync.forceAcknowledge') } } : {}),
    }))
  )
    return
  busy.value = true
  runProblem.value = null
  message.value = ''
  try {
    await requestSyncRun(mode)
    await query.refetch()
    message.value = t('identitySync.queued')
    await client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
  } catch (error) {
    runProblem.value = problemOf(error)
  } finally {
    busy.value = false
  }
}
function valueText(value: IdentitySyncSettings[keyof IdentitySyncSettings]) {
  if (typeof value === 'boolean') return t(value ? 'domains.values.yes' : 'domains.values.no')
  return Array.isArray(value)
    ? value.join(', ') || t('domains.values.none')
    : String(value === '' || value == null ? t('domains.values.none') : value)
}
</script>

<template>
  <ProblemMessage
    v-if="query.isError.value"
    :problem="problemOf(query.error.value)"
    retry
    @retry="query.refetch()"
  />
  <template v-if="stored?.supported && stored.canSync">
    <p v-if="providerEditing" role="status" class="text-sm text-muted">
      {{ t('identityProvider.finishSection') }}
    </p>
    <EditableSection
      v-for="section in sections"
      :key="section.id"
      :section-id="`identity-sync-${section.id}`"
      :title="syncSectionTitle(section.id, t)"
      editable
      :editing="editing && activeSection === section.id"
      :edit-disabled-reason="
        providerEditing || (editing && activeSection !== section.id)
          ? t('identityProvider.finishSection')
          : null
      "
      :saving="saveState.pending.value"
      :version-changed="saveState.outdated.value"
      @edit="open(section.id)"
      @cancel="close"
      @save="save"
      @save-again="save"
      @discard="open(section.id)"
    >
      <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {{ t(`identitySync.sectionHelp.${section.id}`) }}
      </p>
      <dl class="grid gap-3 text-sm sm:grid-cols-2">
        <div v-for="key in section.fields" :key="key" class="min-w-0">
          <dt class="text-gray-600 dark:text-gray-400">{{ lt(syncFieldLabels[key]) }}</dt>
          <dd class="break-words">
            <Badge
              v-if="typeof stored.settings[key] === 'boolean'"
              :color="stored.settings[key] ? 'success' : 'gray'"
              >{{ valueText(stored.settings[key]) }}</Badge
            ><template v-else>{{ valueText(stored.settings[key]) }}</template>
          </dd>
        </div>
      </dl>
      <template #form>
        <ErrorSummary :id="errors.summaryId" :items="errors.summary.value" />
        <ProblemMessage :problem="errors.formProblem.value" />
        <IdentitySyncFields
          v-if="form"
          v-model="form"
          :fields="section.fields"
          :errors-for="errors.errorsFor"
        />
      </template>
    </EditableSection>
    <section class="flex min-w-0 flex-col gap-4" :aria-label="t('identitySync.runsTitle')">
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="me-auto text-lg font-semibold">{{ t('identitySync.runsTitle') }}</h2>
        <button
          v-for="mode in ['preview', 'run', 'force'] as const"
          :key="mode"
          type="button"
          :class="buttonVariants({ variant: mode === 'run' ? 'default' : 'outline' })"
          :disabled="busy || editing || providerEditing"
          @click="run(mode)"
        >
          {{ t(`identitySync.actions.${mode}`) }}
        </button>
      </div>
      <dl class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div v-for="(value, key) in stored.counts" :key="key">
          <dt class="text-gray-600 dark:text-gray-400">{{ t(`identitySync.counts.${key}`) }}</dt>
          <dd class="font-semibold">{{ value }}</dd>
        </div>
      </dl>
      <p v-if="message" role="status">{{ message }}</p>
      <ProblemMessage :problem="runProblem" />
      <IdentitySyncRuns
        :runs="stored.runs"
        :refreshing="query.isFetching.value"
        @refresh="query.refetch()"
      />
    </section>
  </template>
  <IdentityLinkSection v-if="stored?.supported" />
</template>
