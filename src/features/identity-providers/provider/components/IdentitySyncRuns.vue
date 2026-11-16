<script setup lang="ts">
import { computed, ref, useId, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import DataIdentity from '@/shared/components/DataIdentity.vue'
import DataCard from '@/shared/components/DataCard.vue'
import DataCardFields from '@/shared/components/DataCardFields.vue'
import DataTableHeader from '@/shared/components/DataTableHeader.vue'
import ListToolbar from '@/shared/components/ListToolbar.vue'
import RowControls from '@/shared/components/RowControls.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { useLocalDataList, type LocalDataColumn } from '@/shared/composables/useLocalDataList'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { Badge, type BadgeColor } from '@/shared/ui/badge'
import type { IdentitySyncRun } from '../synchronisation-api'
import IdentitySyncRunDetails from './IdentitySyncRunDetails.vue'
const props = defineProps<{ runs: IdentitySyncRun[]; refreshing: boolean }>()
const emit = defineEmits<{ refresh: [] }>()
const { t } = useI18n()
const fmt = useFormat()
const id = useId()
const wide = useMediaQuery('(min-width: 768px)')
const expanded = ref<number[]>([])
const columns = computed<LocalDataColumn<IdentitySyncRun>[]>(() => [
  {
    id: 'mode',
    label: t('identitySync.columns.mode'),
    value: (run) => t(`identitySync.actions.${run.mode}`),
  },
  {
    id: 'status',
    defaultVisible: false,
    label: t('identitySync.columns.status'),
    value: (run) => t(`identitySync.status.${run.status}`),
  },
  { id: 'created', label: t('identitySync.columns.created'), value: (run) => run.createdAt },
  {
    id: 'requestedBy',
    label: t('identitySync.columns.requestedBy'),
    value: (run) => run.requestedBy,
  },
  { id: 'finished', label: t('identitySync.columns.finished'), value: (run) => run.finishedAt },
])
const listing = useLocalDataList('identity-sync-runs', () => props.runs, columns)
watchEffect(() => {
  listing.table.refresh.value = { pending: props.refreshing, run: () => emit('refresh') }
})
const colour = (status: IdentitySyncRun['status']): BadgeColor =>
  status === 'ok'
    ? 'success'
    : status === 'error'
      ? 'error'
      : status === 'blocked'
        ? 'warning'
        : 'info'
function toggle(id: number) {
  expanded.value = expanded.value.includes(id)
    ? expanded.value.filter((value) => value !== id)
    : [...expanded.value, id]
}
</script>
<template>
  <ListToolbar
    ><template #search
      ><SearchField
        :id="`${id}-search`"
        :label="lt('datatables.search')"
        :model-value="listing.search.value"
        @search="listing.search.value = $event" /></template
  ></ListToolbar>
  <p v-if="!listing.rows.value.length" class="text-sm text-muted">
    {{ lt('datatables.emptyTable') }}
  </p>
  <div v-else-if="wide" class="table-frame">
    <table class="data-table w-full text-start">
      <caption class="sr-only">
        {{
          t('identitySync.runsTitle')
        }}
      </caption>
      <thead>
        <tr>
          <DataTableHeader v-for="column in columns" :key="column.id" :column="column.id" />
          <th scope="col">
            <span class="sr-only">{{ t('domains.list.details') }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-for="run in listing.rows.value" :key="run.id"
          ><tr>
            <td v-show="listing.table.visible('mode')">
              <DataIdentity
                >{{ t(`identitySync.actions.${run.mode}`) }} #{{ run.id
                }}<template #badges
                  ><Badge :color="colour(run.status)">{{
                    t(`identitySync.status.${run.status}`)
                  }}</Badge></template
                ></DataIdentity
              >
            </td>
            <td v-show="listing.table.visible('status')">
              {{ t(`identitySync.status.${run.status}`) }}
            </td>
            <td v-show="listing.table.visible('created')">{{ fmt.dateTime(run.createdAt) }}</td>
            <td v-show="listing.table.visible('requestedBy')">
              {{ run.requestedBy || t('identitySync.scheduled') }}
            </td>
            <td v-show="listing.table.visible('finished')">
              {{ run.finishedAt ? fmt.dateTime(run.finishedAt) : '—' }}
            </td>
            <td>
              <RowControls
                :expanded="expanded.includes(run.id)"
                :controls="`${id}-run-${run.id}`"
                :label="t('identitySync.detailsOf', { id: run.id })"
                @toggle="toggle(run.id)"
              />
            </td>
          </tr>
          <tr v-if="expanded.includes(run.id)" :id="`${id}-run-${run.id}`">
            <td :colspan="listing.table.visibleCount.value + 1">
              <IdentitySyncRunDetails :run="run" />
            </td></tr
        ></template>
      </tbody>
    </table>
  </div>
  <ul v-else class="flex flex-col gap-3">
    <DataCard
      v-for="run in listing.rows.value"
      :key="run.id"
      :title="`${t(`identitySync.actions.${run.mode}`)} #${run.id}`"
      ><template #badges
        ><Badge :color="colour(run.status)">{{
          t(`identitySync.status.${run.status}`)
        }}</Badge></template
      ><DataCardFields
        ><div>
          <dt>{{ t('identitySync.columns.created') }}</dt>
          <dd>{{ fmt.dateTime(run.createdAt) }}</dd>
        </div>
        <div>
          <dt>{{ t('identitySync.columns.requestedBy') }}</dt>
          <dd>{{ run.requestedBy || t('identitySync.scheduled') }}</dd>
        </div>
        <div>
          <dt>{{ t('identitySync.columns.finished') }}</dt>
          <dd>{{ run.finishedAt ? fmt.dateTime(run.finishedAt) : '—' }}</dd>
        </div></DataCardFields
      ><template #details><IdentitySyncRunDetails :run="run" /></template
    ></DataCard>
  </ul>
</template>
