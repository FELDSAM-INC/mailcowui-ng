<script setup lang="ts">
// The job page (UI 008 US1, FR-015, FR-020, FR-029), mirroring the classic edit page
// `templates/edit/syncjob.twig` (conventions "Detail pages"): legacy's edit heading with the job
// label, the History action for administrators, the run status with the list's keys, and the edit
// page's form as one section. The job is seeded from a cached list entry; an identifier above the
// contract's maximum shows "not found" without a request, as does a job outside the scope (FR-003).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { isApiProblem } from '@/api'
import { canAccess } from '@/app/navigation/visibility'
import { useIdentityQuery } from '@/app/session/queries'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { lt } from '@/i18n'
import EditableSection from '@/shared/components/EditableSection.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'

import { problemOf, useSyncJob } from '../api'
import SyncJobRunStatus from '../components/SyncJobRunStatus.vue'
import SyncJobValues from '../components/SyncJobValues.vue'
import { parseJobId } from '../list-state'
import { jobLabel } from '../presentation'

const { t } = useI18n()
const route = useRoute()
const identity = useIdentityQuery()
const role = computed(() => identity.data.value?.role ?? 'mailboxUser')
const historyAllowed = computed(() => canAccess('auditLog', identity.data.value))

const id = computed(() => parseJobId(route.params.syncJobId))
const query = useSyncJob(
  () => id.value ?? 0,
  () => id.value !== undefined,
)
const job = computed(() => (id.value === undefined ? undefined : query.data.value))
const notFound = computed(
  () =>
    id.value === undefined ||
    (!job.value && isApiProblem(query.error.value) && query.error.value.status === 404),
)
</script>

<template>
  <NotFoundPage
    v-if="notFound"
    :back-to="{ name: 'sync-jobs' }"
    :back-label="t('syncJobs.detail.backToList')"
  />
  <div
    v-else-if="!job && query.isPending.value"
    data-page-loading
    role="status"
    aria-busy="true"
    class="mx-auto w-full max-w-5xl"
  >
    <p class="text-gray-600 dark:text-gray-400">{{ t('syncJobs.detail.loading') }}</p>
  </div>
  <section v-else-if="!job" class="mx-auto flex w-full max-w-5xl flex-col gap-3">
    <h1
      tabindex="-1"
      class="text-2xl font-semibold text-gray-900 focus:outline-none dark:text-white"
    >
      {{ lt('edit.syncjob') }}
    </h1>
    <p role="alert" class="font-medium text-gray-900 dark:text-white">
      {{ t('syncJobs.detail.loadFailed') }}
    </p>
    <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="query.refetch()" />
  </section>
  <article v-else class="mx-auto flex w-full max-w-5xl flex-col gap-4">
    <PageHeader :title="lt('edit.syncjob')" :description="jobLabel(job)">
      <template #actions>
        <HistoryLink target-type="syncJob" :target-id="String(job.id)" :allowed="historyAllowed" />
      </template>
    </PageHeader>
    <SyncJobRunStatus :job="job" :role="role" />
    <EditableSection
      section-id="syncjob"
      :title="lt('edit.syncjob')"
      :editable="false"
      :editing="false"
    >
      <SyncJobValues :job="job" />
    </EditableSection>
  </article>
</template>
