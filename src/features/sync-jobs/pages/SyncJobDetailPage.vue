<script setup lang="ts">
// The job page (UI 008 US1, US3; FR-015, FR-020, FR-026 to FR-030), mirroring the classic edit page
// `templates/edit/syncjob.twig` (conventions "Detail pages"): legacy's edit heading with the job
// label, the History action for administrators, the run status with the list's keys, and the edit
// page's form as one section with its own save, opened by `?edit=syncjob` (one address per state,
// so Back closes it). Below md the open section replaces the page content. The job is seeded from
// a cached list entry; an identifier above the contract's maximum shows "not found" without a
// request, as does a job outside the scope (FR-003). Leaving with unsaved input asks first.
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'

import { isApiProblem, type SyncJob } from '@/api'
import { canAccess } from '@/app/navigation/visibility'
import { useIdentityQuery } from '@/app/session/queries'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { lt } from '@/i18n'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { confirm } from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'

import { problemOf, useSyncJob, useSyncJobCapabilities } from '../api'
import SyncJobRunStatus from '../components/SyncJobRunStatus.vue'
import SyncJobSection from '../components/SyncJobSection.vue'
import { parseJobId } from '../list-state'
import { jobLabel } from '../presentation'

const SECTION = 'syncjob'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const identity = useIdentityQuery()
const role = computed(() => identity.data.value?.role ?? 'mailboxUser')
const historyAllowed = computed(() => canAccess('auditLog', identity.data.value))
const wide = useMediaQuery('(min-width: 768px)')

const id = computed(() => parseJobId(route.params.syncJobId))
const query = useSyncJob(
  () => id.value ?? 0,
  () => id.value !== undefined,
)
// The last job read stays on screen when it disappears from the cache (deleted elsewhere), so the
// section can say that it no longer exists instead of switching to "not found".
const known = shallowRef<SyncJob | undefined>(undefined)
watch(
  () => query.data.value,
  (value) => {
    if (value) known.value = value
  },
  { immediate: true },
)
watch(id, () => (known.value = undefined))
const job = computed(() => (id.value === undefined ? undefined : (query.data.value ?? known.value)))
const notFound = computed(
  () =>
    id.value === undefined ||
    (!job.value && isApiProblem(query.error.value) && query.error.value.status === 404),
)

// Section editing (research R11, data-model §5): `edit=syncjob` opens the section; another value is
// removed with replace.
const requested = computed(() => (typeof route.query.edit === 'string' ? route.query.edit : null))
const editing = computed(() => requested.value === SECTION && !!job.value)
const capabilities = useSyncJobCapabilities(() => editing.value)
const dirty = ref(false)

watch(
  requested,
  (value) => {
    if (value === null || value === SECTION) return
    const next = { ...route.query }
    delete next.edit
    void router.replace({ query: next, hash: route.hash })
  },
  { immediate: true },
)

function openSection() {
  void router.push({ query: { ...route.query, edit: SECTION }, hash: route.hash })
}

function closeSection() {
  dirty.value = false
  const next = { ...route.query }
  delete next.edit
  const previous = router.options.history.state.back
  const target = router.resolve({ query: next, hash: route.hash }).fullPath
  if (previous === target) router.back()
  else void router.replace({ query: next, hash: route.hash })
}

useLeaveGuard(dirty, { messageKey: 'leaveGuard.body' })
onBeforeRouteUpdate(async (to, from) => {
  if (to.path !== from.path || !dirty.value || to.query.edit === from.query.edit) return true
  const leave = await confirm({
    title: t('leaveGuard.title'),
    description: t('leaveGuard.body'),
    confirmLabel: t('leaveGuard.leave'),
    cancelLabel: t('leaveGuard.stay'),
    destructive: true,
  })
  if (leave) dirty.value = false
  return leave
})

const showOnlySection = computed(() => editing.value && !wide.value)
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
    <template v-if="!showOnlySection">
      <PageHeader :title="lt('edit.syncjob')" :description="jobLabel(job)">
        <template #actions>
          <HistoryLink
            target-type="syncJob"
            :target-id="String(job.id)"
            :allowed="historyAllowed"
          />
        </template>
      </PageHeader>
      <SyncJobRunStatus :job="job" :role="role" />
    </template>
    <SyncJobSection
      :job="job"
      :role="role"
      :editing="editing"
      :caps="capabilities.data.value"
      @edit="openSection"
      @close="closeSection"
      @dirty="dirty = $event"
    />
  </article>
</template>
