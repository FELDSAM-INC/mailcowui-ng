<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { lt } from '@/i18n'
import DataRow from '@/shared/components/DataRow.vue'
import DataIdentity from '@/shared/components/DataIdentity.vue'
import DataTableHeader from '@/shared/components/DataTableHeader.vue'
import DataCard from '@/shared/components/DataCard.vue'
import DataCardFields from '@/shared/components/DataCardFields.vue'
import RowControls from '@/shared/components/RowControls.vue'
import RowAction from '@/shared/components/RowAction.vue'
import { useDataColumns } from '@/shared/composables/useDataList'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { Badge } from '@/shared/ui/badge'
import MailboxStatusBadge from '../components/display/MailboxStatusBadge.vue'
import type { GroupSummary } from './api'

defineProps<{ groups: readonly GroupSummary[] }>()
const { t } = useI18n()
const wide = useMediaQuery('(min-width: 768px)')
const expanded = ref<number[]>([])
const columns = computed(() => [
  { id: 'name', label: t('mailboxGroups.fields.name'), sort: 'name' },
  { id: 'domain', label: t('mailboxGroups.fields.domain'), sort: 'domain' },
  { id: 'address', label: t('mailboxGroups.fields.address'), sort: 'address' },
  { id: 'memberCount', label: t('mailboxGroups.fields.members') },
  {
    id: 'priority',
    label: t('mailboxGroups.fields.priority'),
    sort: 'priority',
    defaultVisible: false,
  },
])
const table = useDataColumns(columns)
const link = (group: GroupSummary) => ({
  name: 'mailbox-group-detail',
  params: { groupId: group.id },
})
function toggle(id: number) {
  expanded.value = expanded.value.includes(id)
    ? expanded.value.filter((value) => value !== id)
    : [...expanded.value, id]
}
</script>
<template>
  <div v-if="wide" class="table-frame">
    <table class="data-table w-full text-start">
      <caption class="sr-only">
        {{
          t('mailboxGroups.title')
        }}
      </caption>
      <thead>
        <tr>
          <DataTableHeader v-for="column in columns" :key="column.id" :column="column.id" />
          <th scope="col" class="table-controls-cell">
            <span class="sr-only">{{ lt('mailbox.action') }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-for="group in groups" :key="group.id">
          <DataRow :to="link(group)">
            <td v-show="table.visible('name')">
              <DataIdentity
                >{{ group.name
                }}<template #badges
                  ><MailboxStatusBadge :status="group.active ? 'active' : 'inactive'" /><Badge
                    v-if="group.identityManaged"
                    color="info"
                    >{{ t('mailboxGroups.identityManaged') }}</Badge
                  ></template
                ></DataIdentity
              >
            </td>
            <td v-show="table.visible('domain')">{{ group.domain }}</td>
            <td v-show="table.visible('address')" class="wrap-anywhere">
              {{ group.address ?? '—' }}
            </td>
            <td v-show="table.visible('memberCount')">{{ group.memberCount }}</td>
            <td v-show="table.visible('priority')">{{ group.priority }}</td>
            <td class="table-controls-cell">
              <RowControls
                :expanded="expanded.includes(group.id)"
                :controls="`group-${group.id}-details`"
                :label="t('domains.list.detailsOf', { name: group.name })"
                @toggle="toggle(group.id)"
                ><RowAction
                  :menu="false"
                  :to="link(group)"
                  :label="`${lt('mailbox.edit')}: ${group.name}`"
                  >{{ lt('mailbox.edit') }}</RowAction
                ></RowControls
              >
            </td>
          </DataRow>
          <tr v-if="expanded.includes(group.id)" :id="`group-${group.id}-details`">
            <td :colspan="table.visibleCount.value + 1">
              <DataCardFields
                ><div>
                  <dt>{{ t('mailboxGroups.fields.description') }}</dt>
                  <dd class="whitespace-pre-wrap wrap-anywhere">{{ group.description || '—' }}</dd>
                </div>
                <div
                  v-for="column in columns.filter((item) => !table.visible(item.id))"
                  :key="column.id"
                >
                  <dt>{{ column.label }}</dt>
                  <dd>{{ group[column.id as keyof GroupSummary] ?? '—' }}</dd>
                </div></DataCardFields
              >
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
  <ul v-else class="flex flex-col gap-3" :aria-label="t('mailboxGroups.title')">
    <DataCard v-for="group in groups" :key="group.id" :title="group.name" :to="link(group)">
      <template #badges
        ><MailboxStatusBadge :status="group.active ? 'active' : 'inactive'" /><Badge
          v-if="group.identityManaged"
          color="info"
          >{{ t('mailboxGroups.identityManaged') }}</Badge
        ></template
      >
      <template #subtitle>{{ group.domain }}</template>
      <template #actions
        ><RowAction
          :menu="false"
          :to="link(group)"
          :label="`${lt('mailbox.edit')}: ${group.name}`"
          >{{ lt('mailbox.edit') }}</RowAction
        ></template
      >
      <DataCardFields
        ><div>
          <dt>{{ t('mailboxGroups.fields.address') }}</dt>
          <dd class="wrap-anywhere">{{ group.address ?? '—' }}</dd>
        </div>
        <div>
          <dt>{{ t('mailboxGroups.fields.members') }}</dt>
          <dd>{{ group.memberCount }}</dd>
        </div></DataCardFields
      >
      <template #details
        ><DataCardFields
          ><div>
            <dt>{{ t('mailboxGroups.fields.description') }}</dt>
            <dd class="whitespace-pre-wrap wrap-anywhere">{{ group.description || '—' }}</dd>
          </div>
          <div>
            <dt>{{ t('mailboxGroups.fields.priority') }}</dt>
            <dd>{{ group.priority }}</dd>
          </div></DataCardFields
        ></template
      >
    </DataCard>
  </ul>
</template>
