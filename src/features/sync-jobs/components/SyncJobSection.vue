<script setup lang="ts">
// The classic edit page `templates/edit/syncjob.twig` as one section of the job page with its own
// edit and save (conventions "Detail pages", "Editing and conflicts"): the stored values in read
// mode, the form in the edit page's order in edit mode, legacy's "Save changes", the outdated
// notice, an existing job with its link, a job gone in the meantime, and field errors.
import { computed, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { Role, SyncJob, SyncJobCapabilities } from '@/api'
import { lt } from '@/i18n'
import EditableSection from '@/shared/components/EditableSection.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'

import { useSyncJobSection } from '../composables/useSyncJobSection'
import SyncJobFormFields from './SyncJobFormFields.vue'
import SyncJobValues from './SyncJobValues.vue'

const props = defineProps<{
  job: SyncJob
  role: Role
  editing: boolean
  caps?: SyncJobCapabilities
}>()
const emit = defineEmits<{ edit: []; close: []; dirty: [value: boolean] }>()
const { t } = useI18n()

const section = useSyncJobSection({
  job: () => props.job,
  editing: () => props.editing,
  caps: () => props.caps,
  close: () => {
    emit('dirty', false)
    emit('close')
  },
  idPrefix: 'syncjob',
})
watch(section.dirty, (value) => emit('dirty', value), { immediate: true })
onBeforeUnmount(() => emit('dirty', false))
const ready = computed(() => !!props.caps)
</script>

<template>
  <EditableSection
    section-id="syncjob"
    :title="lt('edit.syncjob')"
    editable
    :editing="editing"
    :saving="section.pending.value"
    :status="section.status.value"
    :outdated="section.outdated.value"
    :can-save="!section.gone.value"
    :save-label="lt('edit.save')"
    @edit="emit('edit')"
    @cancel="section.cancel"
    @save="section.save"
    @save-again="section.saveAgain"
    @discard="section.discard"
  >
    <SyncJobValues :job="job" />
    <template #form>
      <div
        v-if="section.gone.value"
        role="alert"
        class="flex flex-col items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        <p>{{ t('syncJobs.detail.gone') }}</p>
        <RouterLink :to="{ name: 'sync-jobs' }" class="font-medium underline underline-offset-2">
          {{ t('syncJobs.detail.backToList') }}
        </RouterLink>
      </div>
      <template v-else>
        <div
          v-if="section.existing.value"
          role="alert"
          class="flex flex-col items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          <p class="wrap-anywhere">
            {{ lt('danger.object_exists', section.existing.value.object) }}
          </p>
          <RouterLink
            :to="{ name: 'sync-job-detail', params: { syncJobId: section.existing.value.id } }"
            class="font-medium underline underline-offset-2"
          >
            {{ t('syncJobs.form.openExisting') }}
          </RouterLink>
        </div>
        <ProblemMessage v-if="section.failure.value" :problem="section.failure.value" />
        <ErrorSummary
          :id="section.problemForm.summaryId"
          :items="section.problemForm.summary.value"
        />
        <SyncJobFormFields
          v-if="ready && caps"
          v-model:values="section.form.value"
          mode="edit"
          id-prefix="syncjob"
          :caps="caps"
          :role="role"
          :custom-params-allowed="section.customParamsAllowed.value"
          :password-set="job.remotePasswordSet"
          :errors-for="section.errorsFor"
        />
        <p v-else role="status" class="text-gray-600 dark:text-gray-400">
          {{ lt('datatables.loadingRecords') }}
        </p>
      </template>
    </template>
  </EditableSection>
</template>
