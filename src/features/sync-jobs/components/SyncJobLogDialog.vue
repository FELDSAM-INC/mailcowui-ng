<script setup lang="ts">
// The run log viewer (UI 008 US5, FR-041 to FR-046, research R17), replacing the classic
// `#syncjobLogModal` (title "Log", an editable textarea): full screen below md and a large dialog
// from md up, with the job and its last run (the list's keys) as context, the log read-only and
// verbatim, Copy (the original text), Wrap lines, Refresh and Close. The log is fetched only when
// the viewer opens. A job that never ran says "No log yet", a run without output says so, and a
// running job notes that the log is the previous run's. Loaded lazily, with the log viewer's chunk.
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { isApiProblem, problemOf, type Role } from '@/api'
import { lt, resolveText, type TextRef } from '@/i18n'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { CloseIcon, CopyIcon, SyncIcon } from '@/shared/icons'
import { copyText } from '@/shared/platform/clipboard'
import { buttonVariants } from '@/shared/ui/button'

import { useSyncJob, useSyncJobLog } from '../api'
import { emptyLogState } from '../log-view'
import { jobLabel, listTexts } from '../presentation'
import SyncJobLastRun from './SyncJobLastRun.vue'
import SyncJobLogText from './SyncJobLogText.vue'
import SyncJobResult from './SyncJobResult.vue'

const props = defineProps<{ jobId: number; role: Role }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const wide = useMediaQuery('(min-width: 768px)')
const wrap = ref(true)

const logQuery = useSyncJobLog(() => props.jobId, true)
const jobQuery = useSyncJob(() => props.jobId, true)
const job = computed(() => jobQuery.data.value)
const log = computed(() => logQuery.data.value)
const run = computed(() => log.value?.runStatus ?? job.value?.runStatus)
const gone = computed(
  () =>
    (isApiProblem(logQuery.error.value) && logQuery.error.value.status === 404) ||
    (isApiProblem(jobQuery.error.value) && jobQuery.error.value.status === 404),
)
const texts = computed(() => listTexts(props.role))
const label = (ref: TextRef) => resolveText(ref, t)
const name = computed(() => (job.value ? jobLabel(job.value) : ''))

async function copy() {
  if (!log.value) return
  const outcome = await copyText(log.value.log)
  announce(outcome === 'copied' ? t('syncJobs.log.copied') : t('syncJobs.log.copyRefused'))
}

function refresh() {
  void logQuery.refetch()
  void jobQuery.refetch()
}

const CONTENT_WIDE =
  'fixed start-1/2 top-1/2 z-101 flex h-[90vh] w-[min(64rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700 shadow-theme-lg outline-none rtl:translate-x-1/2 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'
const CONTENT_FULL =
  'fixed inset-0 z-101 flex h-dvh w-full flex-col gap-3 bg-white p-4 text-sm text-gray-700 outline-none dark:bg-gray-900 dark:text-gray-300'
</script>

<template>
  <DialogRoot :open="true" @update:open="(open) => !open && emit('close')">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-100 bg-black/50 dark:bg-black/70" />
      <DialogContent :class="wide ? CONTENT_WIDE : CONTENT_FULL" @close-auto-focus.prevent>
        <div class="flex items-start gap-3">
          <div class="min-w-0 flex-1">
            <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('syncJobs.log.title') }}
            </DialogTitle>
            <DialogDescription class="wrap-anywhere text-gray-600 dark:text-gray-400">
              {{ name }}
            </DialogDescription>
          </div>
          <button
            type="button"
            :class="buttonVariants({ variant: 'ghost', size: 'icon' })"
            :aria-label="t('common.close')"
            @click="emit('close')"
          >
            <CloseIcon />
          </button>
        </div>
        <dl v-if="job && run" class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
          <template v-if="role !== 'mailboxUser'">
            <dt class="text-gray-600 dark:text-gray-400">{{ label(texts.owner) }}</dt>
            <dd class="wrap-anywhere text-gray-900 dark:text-white">{{ job.mailbox }}</dd>
          </template>
          <dt class="text-gray-600 dark:text-gray-400">{{ label(texts.lastRun) }}</dt>
          <dd class="text-gray-900 dark:text-white"><SyncJobLastRun :run="run" :role="role" /></dd>
          <dt class="text-gray-600 dark:text-gray-400">{{ label(texts.result) }}</dt>
          <dd class="text-gray-900 dark:text-white"><SyncJobResult :run="run" :role="role" /></dd>
        </dl>
        <p
          v-if="run?.running"
          role="status"
          class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          {{ t('syncJobs.log.running') }}
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline' })"
            :disabled="!log || log.log === ''"
            @click="copy"
          >
            <CopyIcon class="size-5" />
            {{ t('syncJobs.log.copy') }}
          </button>
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline' })"
            :aria-pressed="wrap ? 'true' : 'false'"
            @click="wrap = !wrap"
          >
            {{ t('syncJobs.log.wrap') }}
          </button>
          <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="refresh">
            <SyncIcon :class="logQuery.isFetching.value ? 'motion-safe:animate-spin' : ''" />
            {{ lt('admin.refresh') }}
          </button>
        </div>
        <p v-if="gone" role="alert" class="font-medium text-gray-900 dark:text-white">
          {{ t('syncJobs.detail.gone') }}
        </p>
        <div v-else-if="logQuery.isPending.value" role="status" aria-busy="true">
          {{ lt('datatables.loadingRecords') }}
        </div>
        <ProblemMessage
          v-else-if="!log"
          :problem="problemOf(logQuery.error.value)"
          retry
          @retry="refresh"
        />
        <p v-else-if="log.log === ''" class="text-gray-700 dark:text-gray-300">
          {{
            emptyLogState(log.runStatus) === 'never'
              ? t('syncJobs.log.never')
              : t('syncJobs.log.noOutput')
          }}
        </p>
        <SyncJobLogText
          v-else
          :text="log.log"
          :wrap="wrap"
          :label="t('syncJobs.log.region', { name })"
        />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
