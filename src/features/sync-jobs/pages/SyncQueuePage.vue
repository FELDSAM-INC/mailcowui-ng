<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { api, problemOf, queryKeys, requireData, type components } from '@/api'
import PageHeader from '@/shared/components/PageHeader.vue'
import EditableSection from '@/shared/components/EditableSection.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import ValueList from '@/shared/components/ValueList.vue'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
type Settings = components['schemas']['SyncQueueSettings']
const { t } = useI18n()
const query = useQuery({
  queryKey: [...queryKeys.syncJobs.all(), 'queue-settings'],
  queryFn: async () => requireData(await api.GET('/sync-queue/settings')).data,
})
const form = ref<{ maxParallel: number; maxBytesPerSecond: number }>(),
  base = shallowRef<Settings>(),
  original = shallowRef<Settings>()
const errors = useProblemForm({ fieldId: (field) => `queue-${field}` })
const dirty = computed(
  () =>
    !!form.value &&
    (form.value.maxParallel !== original.value?.maxParallel ||
      form.value.maxBytesPerSecond !== original.value?.maxBytesPerSecond),
)
const version = useVersionedSave({
  current: () => base.value,
  refetch: async () => {
    const data = (await query.refetch()).data
    base.value = data
    return data
  },
})
const leave = useLeaveGuard(dirty, 'leaveGuard.body')
function open() {
  if (!query.data.value) return
  base.value = query.data.value
  original.value = query.data.value
  form.value = {
    maxParallel: base.value.maxParallel,
    maxBytesPerSecond: base.value.maxBytesPerSecond,
  }
  errors.clear()
  version.discard()
}
async function cancel() {
  if (dirty.value && !(await leave.ask())) return
  form.value = undefined
  errors.clear()
  version.discard()
}
async function save() {
  if (!form.value || !original.value || version.pending.value) return
  errors.clear()
  const patch = Object.fromEntries(
    Object.entries(form.value).filter(
      ([key, value]) => value !== original.value?.[key as keyof Settings],
    ),
  )
  if (!Object.keys(patch).length) {
    form.value = undefined
    return
  }
  const result = await version.save(
    patch,
    async (body, etag) =>
      requireData(
        await api.PATCH('/sync-queue/settings', {
          body,
          params: { header: { 'If-Match': etag } },
          headers: { 'Content-Type': 'application/merge-patch+json' },
        }),
      ).data,
  )
  if (result.status === 'saved') {
    form.value = undefined
    await query.refetch()
  } else if (result.status === 'failed') await errors.setProblem(result.problem)
}
const items = computed(() =>
  query.data.value
    ? [
        {
          key: 'maxParallel',
          label: t('syncSources.fields.maxParallel'),
          value: String(query.data.value.maxParallel),
        },
        {
          key: 'maxBytesPerSecond',
          label: t('syncSources.fields.maxBytesPerSecond'),
          value: query.data.value.maxBytesPerSecond
            ? String(query.data.value.maxBytesPerSecond)
            : t('syncSources.unlimited'),
        },
      ]
    : [],
)
</script>
<template>
  <section class="space-y-4">
    <PageHeader
      :title="t('nav.syncQueue')"
      :description="t('syncSources.queueHelp')"
    /><ProblemMessage
      :problem="problemOf(query.error.value)"
      @retry="query.refetch()"
    /><EditableSection
      v-if="query.data.value"
      editable
      section-id="sync-queue"
      :title="t('syncSources.queueSettings')"
      :editing="!!form"
      :saving="version.pending.value"
      :version-changed="version.outdated.value"
      @edit="open"
      @cancel="cancel"
      @save="save"
      @save-again="save"
      @discard="open"
      ><ValueList :items="items" /><template #form
        ><ErrorSummary :id="errors.summaryId" :items="errors.summary.value" /><ProblemMessage
          :problem="errors.formProblem.value" />
        <fieldset
          v-if="form"
          :disabled="version.pending.value"
          class="grid min-w-0 gap-4 md:grid-cols-2"
        >
          <FormField
            v-for="field in ['maxParallel', 'maxBytesPerSecond'] as const"
            :id="`queue-${field}`"
            :key="field"
            :label="t(`syncSources.fields.${field}`)"
            :errors="errors.errorsFor(field)"
            required
            ><template #default="control"
              ><input
                v-bind="control"
                v-model.number="form[field]"
                type="number"
                class="form-control"
                :min="field === 'maxParallel' ? 1 : 0"
                :max="field === 'maxParallel' ? 32 : 10737418240"
                step="1"
                required /></template
          ></FormField></fieldset></template
    ></EditableSection>
  </section>
</template>
