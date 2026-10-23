<script setup lang="ts">
import DataCardFields from '@/shared/components/DataCardFields.vue'
import DataCard from '@/shared/components/DataCard.vue'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { problemOf, type MassMailJobStatus } from '@/api'
import { lt } from '@/i18n'
import PageHeader from '@/shared/components/PageHeader.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import FormField from '@/shared/components/FormField.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import DateTime from '@/shared/components/DateTime.vue'
import { buttonVariants } from '@/shared/ui/button'
import { oneOf, text, useListState } from '@/shared/composables/useListState'
import { jobListOptions, runningJobOptions } from '../../api/mass-mail'
import JobProgress from '../../components/mass-mail/JobProgress.vue'
const { t } = useI18n()
const list = useListState({
  filters: { q: text({ maxLength: 255 }), status: oneOf(['running', 'completed', 'cancelled']) },
})
const params = computed(() => ({
  ...list.paging.value,
  ...list.state.value.filters,
  sort: 'createdAt' as const,
  order: 'desc' as const,
}))
const query = useQuery(computed(() => jobListOptions(params.value))),
  running = useQuery(runningJobOptions())
const search = ref(list.state.value.filters.q ?? '')
watch(
  () => list.state.value.filters.q,
  (value) => {
    search.value = value ?? ''
  },
)
let timer: ReturnType<typeof setTimeout> | undefined
function searchChanged() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    void list.setFilter('q', search.value || undefined, { typing: true })
  }, 300)
}
onScopeDispose(() => {
  if (timer) clearTimeout(timer)
})
</script>
<template>
  <div class="min-w-0 space-y-4">
    <PageHeader :title="t('systemSettings.massMail.jobs')"
      ><template #actions
        ><HistoryLink target-type="massMailJob" /><RouterLink
          :to="{ name: 'system-settings-mass-mail-send' }"
          :class="buttonVariants({ variant: 'default' })"
          >{{ t('systemSettings.massMail.compose') }}</RouterLink
        ></template
      ></PageHeader
    >
    <RouterLink
      v-if="running.data.value?.data[0]"
      :to="{
        name: 'system-settings-mass-mail-job',
        params: { jobId: running.data.value.data[0].id },
      }"
      :class="buttonVariants({ variant: 'outline' })"
      >{{ t('systemSettings.massMail.viewJob') }}</RouterLink
    >
    <div class="grid gap-4 sm:grid-cols-2">
      <FormField id="mass-jobs-search" :label="t('systemSettings.massMail.searchJobs')"
        ><template #default="control"
          ><input
            v-bind="control"
            v-model="search"
            type="search"
            class="form-control"
            @input="searchChanged" /></template></FormField
      ><FormField id="mass-job-status" :label="t('systemSettings.massMail.status')"
        ><template #default="control"
          ><select
            v-bind="control"
            :value="list.state.value.filters.status ?? ''"
            class="form-control"
            @change="
              list.setFilter(
                'status',
                (($event.target as HTMLSelectElement).value || undefined) as
                  MassMailJobStatus | undefined,
              )
            "
          >
            <option value="">{{ t('systemSettings.massMail.allStatuses') }}</option>
            <option
              v-for="status in ['running', 'completed', 'cancelled']"
              :key="status"
              :value="status"
            >
              {{ t(`systemSettings.massMail.statuses.${status}`) }}
            </option>
          </select></template
        ></FormField
      >
    </div>
    <p v-if="query.isPending.value" role="status">{{ lt('footer.loading') }}</p>
    <ProblemMessage
      v-else-if="query.error.value"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <template v-else-if="query.data.value">
      <p v-if="!query.data.value.meta.total" data-jobs-empty>
        {{ t('systemSettings.massMail.empty') }}
      </p>
      <div data-job-list>
        <ul class="space-y-3 md:hidden">
          <DataCard
            v-for="job in query.data.value.data"
            :key="job.id"
            :title="job.subject"
            :to="{ name: 'system-settings-mass-mail-job', params: { jobId: job.id } }"
          >
            <template #badges>
              <span>{{ t(`systemSettings.massMail.statuses.${job.status}`) }}</span>
            </template>
            <DataCardFields>
              <div>
                <dt>{{ t('systemSettings.massMail.creator') }}</dt>
                <dd>{{ job.createdBy.username }}</dd>
              </div>
              <div>
                <dt>{{ t('systemSettings.massMail.createdAt') }}</dt>
                <dd><DateTime :value="job.createdAt" /></dd>
              </div>
            </DataCardFields>
            <JobProgress :counts="job.counts" />
          </DataCard>
        </ul>
        <div class="table-frame hidden md:block">
          <table class="data-table w-full text-start">
            <thead>
              <tr>
                <th scope="col" class="p-3 text-start">{{ lt('admin.subject') }}</th>
                <th scope="col" class="p-3 text-start">
                  {{ t('systemSettings.massMail.status') }}
                </th>
                <th scope="col" class="p-3 text-start">
                  {{ t('systemSettings.massMail.creator') }}
                </th>
                <th scope="col" class="p-3 text-start" aria-sort="descending">
                  {{ t('systemSettings.massMail.createdAt') }}
                </th>
                <th scope="col" class="p-3 text-start">
                  {{ lt('admin.recipients') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="job in query.data.value.data"
                :key="job.id"
                class="border-t border-gray-200 dark:border-gray-800"
              >
                <td class="max-w-xs p-3">
                  <RouterLink
                    :to="{ name: 'system-settings-mass-mail-job', params: { jobId: job.id } }"
                    :class="
                      buttonVariants({
                        variant: 'link',
                        class: 'h-auto min-h-11 whitespace-normal wrap-anywhere',
                      })
                    "
                    >{{ job.subject }}</RouterLink
                  >
                </td>
                <td class="p-3">{{ t(`systemSettings.massMail.statuses.${job.status}`) }}</td>
                <td class="p-3 wrap-anywhere">{{ job.createdBy.username }}</td>
                <td class="p-3"><DateTime :value="job.createdAt" /></td>
                <td class="min-w-64 p-3"><JobProgress :counts="job.counts" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <PaginationBar
        :total="query.data.value.meta.total"
        :page="list.state.value.page"
        :size="list.state.value.size"
        @update:page="list.setPage"
        @update:size="(size) => list.setSize(size as 25 | 50 | 100)"
      />
    </template>
  </div>
</template>
