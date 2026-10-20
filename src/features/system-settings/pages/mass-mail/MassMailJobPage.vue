<script setup lang="ts">
import { computed, onScopeDispose, ref, watch, shallowRef, watchEffect } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  problemOf,
  type ApiProblem,
  type MassMailRecipientOutcome,
  type SettingsCapabilities,
} from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import { useSessionStore } from '@/app/session/store'
import PageHeader from '@/shared/components/PageHeader.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import FormField from '@/shared/components/FormField.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import RelativeTime from '@/shared/components/RelativeTime.vue'
import DateTime from '@/shared/components/DateTime.vue'
import CodeEditor from '@/shared/components/code-editor/CodeEditor.vue'
import EmailPreviewDialog from '@/shared/components/email/EmailPreviewDialog.vue'
import { buttonVariants } from '@/shared/ui/button'
import { oneOf, text, useListState } from '@/shared/composables/useListState'
import { useConfirm } from '@/shared/composables/useConfirm'
import { announce } from '@/shared/composables/useAnnouncer'
import { jobOptions, recipientOptions, cancelJob } from '../../api/mass-mail'
import { useJobRefresh } from '../../composables/useJobRefresh'
import { failureLabel } from '../../lib/selection'
import JobProgress from '../../components/mass-mail/JobProgress.vue'

const props = defineProps<{ capabilities: SettingsCapabilities }>()
const route = useRoute(),
  client = useQueryClient(),
  session = useSessionStore(),
  confirm = useConfirm()
const { t } = useI18n(),
  format = useFormat(),
  id = computed(() => String(route.params.jobId))
const interval = ref<number | false>(false)
const query = useQuery(
  computed(() => ({
    ...jobOptions(id.value),
    refetchInterval: interval.value,
    refetchIntervalInBackground: false,
  })),
)
const refresh = useJobRefresh({
  status: () => query.data.value?.status,
  idleTimeout: () => session.idleTimeout,
  dataUpdatedAt: () => query.dataUpdatedAt.value,
  refetch: () => query.refetch(),
  finished: () =>
    client.invalidateQueries({ queryKey: ['mass-mail-jobs', 'recipients', id.value] }),
  announce: () => {
    if (query.data.value)
      announce(
        Object.entries(query.data.value.counts)
          .map(
            ([key, count]) =>
              `${t(`systemSettings.massMail.outcomes.${key}`)}: ${format.number(count)}`,
          )
          .join(', '),
      )
  },
})
watchEffect(() => {
  interval.value = refresh.interval.value
})
const list = useListState({
  filters: {
    q: text({ maxLength: 255 }),
    outcome: oneOf(['pending', 'delivered', 'failed', 'skipped']),
  },
})
const recipients = useQuery(
  computed(() => ({
    ...recipientOptions(id.value, {
      ...list.paging.value,
      ...list.state.value.filters,
      sort: 'address',
      order: 'asc',
    }),
    enabled: !!query.data.value,
  })),
)
const search = ref(list.state.value.filters.q ?? ''),
  preview = ref(false),
  cancelling = ref(false),
  completed = ref(false),
  actionProblem = shallowRef<ApiProblem | null>(null)
watch(
  () => list.state.value.filters.q,
  (value) => {
    search.value = value ?? ''
  },
)
let timer: ReturnType<typeof setTimeout> | undefined,
  disposed = false
onScopeDispose(() => {
  disposed = true
  if (timer) clearTimeout(timer)
})
function searchChanged() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    void list.setFilter('q', search.value || undefined, { typing: true })
  }, 300)
}
async function cancel() {
  const target = query.data.value
  if (!target || target.status !== 'running' || cancelling.value || props.capabilities.demoMode)
    return
  const yes = await confirm({
    title: t('systemSettings.massMail.cancel'),
    description: t('systemSettings.massMail.cancelNote'),
    confirmLabel: t('systemSettings.massMail.cancel'),
    destructive: true,
  })
  if (
    !yes ||
    disposed ||
    id.value !== target.id ||
    cancelling.value ||
    props.capabilities.demoMode ||
    query.data.value?.status !== 'running'
  )
    return
  cancelling.value = true
  actionProblem.value = null
  try {
    await cancelJob(target.id, client)
  } catch (error) {
    if (!disposed) {
      const problem = problemOf(error)
      if (problem?.status === 409) {
        completed.value = true
        await query.refetch()
      } else actionProblem.value = problem
    }
  } finally {
    if (!disposed) cancelling.value = false
  }
}
</script>
<template>
  <div class="min-w-0 space-y-4" data-mass-mail-job>
    <PageHeader :title="query.data.value?.subject ?? t('systemSettings.massMail.jobs')"
      ><template #actions
        ><HistoryLink target-type="massMailJob" :target-id="id" /><RouterLink
          :to="{ name: 'system-settings-mass-mail-jobs' }"
          :class="buttonVariants({ variant: 'outline' })"
          >{{ t('systemSettings.massMail.jobs') }}</RouterLink
        ></template
      ></PageHeader
    >
    <p v-if="query.isPending.value" role="status">{{ lt('footer.loading') }}</p>
    <ProblemMessage
      v-else-if="!query.data.value"
      :problem="problemOf(query.error.value)"
      :retry="problemOf(query.error.value)?.status !== 404"
      @retry="query.refetch()"
    />
    <template v-if="query.data.value">
      <ProblemMessage
        v-if="query.error.value"
        :problem="problemOf(query.error.value)"
        retry
        @retry="query.refetch()"
      />
      <p data-job-status class="font-semibold">
        {{ t(`systemSettings.massMail.statuses.${query.data.value.status}`) }}
      </p>
      <JobProgress :counts="query.data.value.counts" />
      <div class="flex flex-wrap items-center gap-3">
        <p>
          {{ t('systemSettings.massMail.updated') }}:
          <RelativeTime :value="query.dataUpdatedAt.value" />
        </p>
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :disabled="query.isFetching.value"
          @click="refresh.refresh"
        >
          {{ lt('admin.refresh') }}</button
        ><button
          v-if="refresh.running.value"
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          @click="
            refresh.paused.value || refresh.inactive.value ? refresh.resume() : refresh.pause()
          "
        >
          {{
            t(
              refresh.paused.value || refresh.inactive.value
                ? 'systemSettings.massMail.resume'
                : 'systemSettings.massMail.pause',
            )
          }}</button
        ><button
          v-if="refresh.running.value && !capabilities.demoMode"
          type="button"
          :disabled="cancelling"
          :class="buttonVariants({ variant: 'outline' })"
          @click="cancel"
        >
          {{ t('systemSettings.massMail.cancel') }}
        </button>
      </div>
      <p v-if="refresh.inactive.value" role="status">{{ t('systemSettings.massMail.inactive') }}</p>
      <p v-if="completed" role="status">{{ t('systemSettings.massMail.alreadyCompleted') }}</p>
      <ProblemMessage :problem="actionProblem" />
      <dl class="grid gap-2 sm:grid-cols-[auto_1fr]">
        <dt class="font-medium">{{ lt('admin.from') }}</dt>
        <dd class="wrap-anywhere">{{ query.data.value.sender }}</dd>
        <dt class="font-medium">{{ t('systemSettings.massMail.creator') }}</dt>
        <dd class="wrap-anywhere">{{ query.data.value.createdBy.username }}</dd>
        <dt class="font-medium">{{ t('systemSettings.massMail.createdAt') }}</dt>
        <dd><DateTime :value="query.data.value.createdAt" /></dd>
        <template v-if="query.data.value.startedAt"
          ><dt class="font-medium">{{ t('systemSettings.massMail.startedAt') }}</dt>
          <dd><DateTime :value="query.data.value.startedAt" /></dd
        ></template>
        <template v-if="query.data.value.finishedAt"
          ><dt class="font-medium">{{ t('systemSettings.massMail.finishedAt') }}</dt>
          <dd><DateTime :value="query.data.value.finishedAt" /></dd
        ></template>
        <template v-if="query.data.value.cancelledBy"
          ><dt class="font-medium">{{ t('systemSettings.massMail.cancelledBy') }}</dt>
          <dd>{{ query.data.value.cancelledBy.username }}</dd></template
        >
        <dt class="font-medium">{{ t('systemSettings.massMail.recipients') }}</dt>
        <dd class="wrap-anywhere">
          <p v-if="!query.data.value.selection.domains?.length">
            {{ t('systemSettings.massMail.all') }}
          </p>
          <p v-for="(values, mode) in query.data.value.selection" :key="mode">
            {{ t(`systemSettings.massMail.${mode}`) }}: {{ values?.join(', ') }}
          </p>
        </dd>
      </dl>
      <section class="space-y-4">
        <h2 class="text-xl font-semibold">{{ t('systemSettings.massMail.recipients') }}</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField
            id="job-recipient-search"
            :label="t('systemSettings.massMail.searchRecipients')"
            ><template #default="control"
              ><input
                v-bind="control"
                v-model="search"
                type="search"
                class="form-control"
                @input="searchChanged" /></template></FormField
          ><FormField id="job-recipient-outcome" :label="t('systemSettings.massMail.outcome')"
            ><template #default="control"
              ><select
                v-bind="control"
                :value="list.state.value.filters.outcome ?? ''"
                class="form-control"
                @change="
                  list.setFilter(
                    'outcome',
                    (($event.target as HTMLSelectElement).value || undefined) as
                      MassMailRecipientOutcome | undefined,
                  )
                "
              >
                <option value="">{{ t('systemSettings.massMail.allOutcomes') }}</option>
                <option
                  v-for="outcome in ['pending', 'delivered', 'failed', 'skipped']"
                  :key="outcome"
                  :value="outcome"
                >
                  {{ t(`systemSettings.massMail.outcomes.${outcome}`) }}
                </option>
              </select></template
            ></FormField
          >
        </div>
        <p v-if="recipients.isPending.value" role="status">{{ lt('footer.loading') }}</p>
        <ProblemMessage
          v-else-if="recipients.error.value"
          :problem="problemOf(recipients.error.value)"
          retry
          @retry="recipients.refetch()"
        />
        <template v-else-if="recipients.data.value">
          <p v-if="!recipients.data.value.meta.total">{{ lt('datatables.infoEmpty') }}</p>
          <ul class="divide-y divide-gray-200 dark:divide-gray-800">
            <li
              v-for="recipient in recipients.data.value.data"
              :key="recipient.address"
              data-job-recipient
              class="space-y-1 py-3"
            >
              <p class="wrap-anywhere">{{ recipient.address }}</p>
              <p>{{ t(`systemSettings.massMail.outcomes.${recipient.outcome}`) }}</p>
              <p v-if="recipient.outcome === 'failed'">
                {{ t(`systemSettings.massMail.failures.${failureLabel(recipient.failureCode)}`) }}
              </p>
            </li>
          </ul>
          <PaginationBar
            :total="recipients.data.value.meta.total"
            :page="list.state.value.page"
            :size="list.state.value.size"
            @update:page="list.setPage"
            @update:size="(size) => list.setSize(size as 25 | 50 | 100)"
        /></template>
      </section>
      <CodeEditor
        id="job-text"
        :model-value="query.data.value.textBody"
        :label="lt('admin.text')"
        readonly
        :line-numbers="false"
        :max-bytes="capabilities.massMail.maxBodyBytes"
      />
      <button
        v-if="query.data.value.htmlBody"
        type="button"
        :class="buttonVariants({ variant: 'outline' })"
        @click="preview = true"
      >
        {{ t('emailTemplate.preview') }}
      </button>
      <EmailPreviewDialog
        v-if="preview"
        v-model:open="preview"
        :html="query.data.value.htmlBody ?? ''"
      />
    </template>
  </div>
</template>
