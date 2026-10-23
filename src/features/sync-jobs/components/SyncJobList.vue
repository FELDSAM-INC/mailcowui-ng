<script setup lang="ts">
// The jobs of the current page: cards below md, a table from md up (FR-008). Slots are passed on:
// `select-all`, `select` and `actions`.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Role, SyncJob } from '@/api'
import { resolveText } from '@/i18n'
import type { SortOrder } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'

import type { SyncJobSort } from '../list-state'
import { listTexts } from '../presentation'
import SyncJobCard from './SyncJobCard.vue'
import SyncJobTable from './SyncJobTable.vue'

const props = withDefaults(
  defineProps<{
    jobs: readonly SyncJob[]
    role: Role
    sort: SyncJobSort
    order: SortOrder
    selectable?: boolean
  }>(),
  { selectable: false },
)
const emit = defineEmits<{
  sort: [sort: SyncJobSort, order: SortOrder]
}>()
const { t } = useI18n()
const wide = useMediaQuery('(min-width: 768px)')
const title = computed(() => resolveText(listTexts(props.role).title, t))
</script>

<template>
  <SyncJobTable
    :hidden="!wide"
    :jobs="jobs"
    :role="role"
    :sort="sort"
    :order="order"
    :selectable="selectable"
    @sort="(sort, order) => emit('sort', sort, order)"
  >
    <template #select-all><slot name="select-all" /></template>
    <template #select="{ job }"><slot name="select" :job="job" /></template>
    <template #actions="{ job }"><slot name="actions" :job="job" /></template>
  </SyncJobTable>
  <ul v-if="!wide" :aria-label="title" class="flex flex-col gap-3">
    <SyncJobCard v-for="job in jobs" :key="job.id" :job="job" :role="role">
      <template v-if="selectable" #select><slot name="select" :job="job" /></template>
      <template #actions><slot name="actions" :job="job" /></template>
    </SyncJobCard>
  </ul>
</template>
