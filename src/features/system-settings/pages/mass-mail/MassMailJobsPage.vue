<script setup lang="ts">
import DataRow from '@/shared/components/DataRow.vue'

import ListToolbar from '@/shared/components/ListToolbar.vue'
import FilterPanel from '@/shared/components/FilterPanel.vue'
import SearchField from '@/shared/components/SearchField.vue'
import DataTableHeader from '@/shared/components/DataTableHeader.vue'
import { useDataList, useDataColumns } from '@/shared/composables/useDataList'

import DataCardFields from '@/shared/components/DataCardFields.vue'
import DataCard from '@/shared/components/DataCard.vue'
import { computed, ref, watch } from 'vue'
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
  sort: {
    values: ['createdAt', 'status'] as const,
    default: 'createdAt',
    defaultOrder: () => 'desc',
  },
  filters: { q: text({ maxLength: 255 }), status: oneOf(['running', 'completed', 'cancelled']) },
})
const params = computed(() => ({
  ...list.paging.value,
  ...list.state.value.filters,
  sort: list.state.value.sort ?? 'createdAt',
  order: list.state.value.order ?? 'desc',
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

const dataList = useDataList(
  'mass-mail-jobs',
  () => ({
    key: list.state.value.sort,
    order: list.state.value.order ?? 'desc',
    change: (key, order) => {
      void list.setSort(key as 'createdAt' | 'status', order)
    },
  }),
  () => ({ run: () => query.refetch(), pending: query.isFetching.value, disabled: false }),
)
const tableView = useDataColumns(
  () => [
    { id: 'subject', label: lt('admin.subject') },
    { id: 'status', label: t('systemSettings.massMail.status'), sort: 'status' },
    { id: 'creator', label: t('systemSettings.massMail.creator') },
    { id: 'createdAt', label: t('systemSettings.massMail.createdAt'), sort: 'createdAt' },
    { id: 'recipients', label: lt('admin.recipients') },
  ],
  undefined,
  dataList,
)
</script>
<template>
  <div class="min-w-0 space-y-4">
    <PageHeader :title="t('systemSettings.massMail.jobs')"
      ><template #actions><HistoryLink target-type="massMailJob" /></template
    ></PageHeader>
    <RouterLink
      v-if="running.data.value?.data[0]"
      :to="{
        name: 'system-settings-mass-mail-job',
        params: { jobId: running.data.value.data[0].id },
      }"
      :class="buttonVariants({ variant: 'outline' })"
      >{{ t('systemSettings.massMail.viewJob') }}</RouterLink
    >
    <div>
      <ListToolbar
        ><template #filters
          ><FilterPanel
            id="mass-jobs-filters"
            immediate
            :active-count="list.state.value.filters.status ? 1 : 0"
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
            ></FilterPanel
          ></template
        ><template #search
          ><SearchField
            id="mass-jobs-search"
            :label="t('systemSettings.massMail.searchJobs')"
            :model-value="list.state.value.filters.q ?? ''"
            @search="
              (value) => list.setFilter('q', value || undefined, { typing: true })
            " /></template
      ></ListToolbar>
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
                <DataTableHeader column="subject" />
                <DataTableHeader column="status" />
                <DataTableHeader column="creator" />
                <DataTableHeader column="createdAt" />
                <DataTableHeader column="recipients" />
              </tr>
            </thead>
            <tbody>
              <DataRow
                v-for="job in query.data.value.data"
                :key="job.id"
                :to="{ name: 'system-settings-mass-mail-job', params: { jobId: job.id } }"
                :label="String(job.id)"
                class="border-t border-gray-200 dark:border-gray-800"
              >
                <td
                  v-show="tableView.visible('subject')"
                  :data-column="'subject'"
                  class="max-w-xs p-3"
                >
                  <span class="font-medium wrap-anywhere">{{ job.subject }}</span>
                </td>
                <td v-show="tableView.visible('status')" :data-column="'status'" class="p-3">
                  {{ t(`systemSettings.massMail.statuses.${job.status}`) }}
                </td>
                <td
                  v-show="tableView.visible('creator')"
                  :data-column="'creator'"
                  class="p-3 wrap-anywhere"
                >
                  {{ job.createdBy.username }}
                </td>
                <td v-show="tableView.visible('createdAt')" :data-column="'createdAt'" class="p-3">
                  <DateTime :value="job.createdAt" />
                </td>
                <td
                  v-show="tableView.visible('recipients')"
                  :data-column="'recipients'"
                  class="min-w-64 p-3"
                >
                  <JobProgress :counts="job.counts" />
                </td>
              </DataRow>
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
