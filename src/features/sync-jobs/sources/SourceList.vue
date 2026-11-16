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
import ActiveBadge from '@/shared/components/ActiveBadge.vue'
import { useDataColumns } from '@/shared/composables/useDataList'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { Badge } from '@/shared/ui/badge'
import type { SyncSource } from './api'
defineProps<{ sources: readonly SyncSource[] }>()
const { t } = useI18n(),
  wide = useMediaQuery('(min-width: 768px)'),
  expanded = ref<number[]>([])
const columns = computed(() => [
  { id: 'name', label: t('syncSources.fields.name'), sort: 'name' },
  { id: 'remoteHost', label: t('syncSources.fields.remoteHost'), sort: 'remoteHost' },
  { id: 'authMechanism', label: t('syncSources.fields.authMechanism') },
  { id: 'scope', label: t('syncSources.fields.scope'), sort: 'scope' },
  { id: 'createdBy', label: t('syncSources.fields.createdBy'), defaultVisible: false },
])
const table = useDataColumns(columns)
const link = (s: SyncSource) => ({ name: 'sync-source-detail', params: { sourceId: s.id } })
const action = (s: SyncSource) => (s.editable ? lt('mailbox.edit') : t('syncSources.view'))
function toggle(id: number) {
  expanded.value = expanded.value.includes(id)
    ? expanded.value.filter((v) => v !== id)
    : [...expanded.value, id]
}
</script>
<template>
  <div v-if="wide" class="table-frame">
    <table class="data-table w-full text-start">
      <caption class="sr-only">
        {{
          t('nav.syncSources')
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
        <template v-for="source in sources" :key="source.id"
          ><DataRow :to="link(source)"
            ><td v-show="table.visible('name')">
              <DataIdentity
                >{{ source.name
                }}<template #badges
                  ><ActiveBadge :active="source.active" /><Badge
                    v-if="source.oauth?.refreshFailed"
                    color="error"
                    >{{ t('syncSources.refreshFailed') }}</Badge
                  ></template
                ></DataIdentity
              >
            </td>
            <td v-show="table.visible('remoteHost')" class="wrap-anywhere">
              {{ source.remoteHost }}:{{ source.remotePort }}
            </td>
            <td v-show="table.visible('authMechanism')">
              {{ source.authMechanism.toUpperCase() }}
            </td>
            <td v-show="table.visible('scope')">{{ t(`syncSources.scopes.${source.scope}`) }}</td>
            <td v-show="table.visible('createdBy')">{{ source.createdBy || '—' }}</td>
            <td class="table-controls-cell">
              <RowControls
                :expanded="expanded.includes(source.id)"
                :controls="`source-${source.id}-details`"
                :label="t('domains.list.detailsOf', { name: source.name })"
                @toggle="toggle(source.id)"
                ><RowAction
                  :menu="false"
                  :to="link(source)"
                  :label="`${action(source)}: ${source.name}`"
                  >{{ action(source) }}</RowAction
                ></RowControls
              >
            </td></DataRow
          >
          <tr v-if="expanded.includes(source.id)" :id="`source-${source.id}-details`">
            <td :colspan="table.visibleCount.value + 1">
              <DataCardFields
                ><div>
                  <dt>{{ t('syncSources.fields.description') }}</dt>
                  <dd class="whitespace-pre-wrap wrap-anywhere">{{ source.description || '—' }}</dd>
                </div>
                <div>
                  <dt>{{ t('syncSources.fields.createdBy') }}</dt>
                  <dd>{{ source.createdBy || '—' }}</dd>
                </div>
                <div>
                  <dt>{{ t('syncSources.targets') }}</dt>
                  <dd class="wrap-anywhere">
                    {{ [...source.domains, ...source.users].join(', ') || '—' }}
                  </dd>
                </div></DataCardFields
              >
            </td>
          </tr></template
        >
      </tbody>
    </table>
  </div>
  <ul v-else class="flex flex-col gap-3" :aria-label="t('nav.syncSources')">
    <DataCard v-for="source in sources" :key="source.id" :title="source.name" :to="link(source)"
      ><template #badges><ActiveBadge :active="source.active" /></template
      ><template #subtitle>{{ source.remoteHost }}:{{ source.remotePort }}</template
      ><template #actions
        ><RowAction :menu="false" :to="link(source)" :label="`${action(source)}: ${source.name}`">{{
          action(source)
        }}</RowAction></template
      ><DataCardFields
        ><div>
          <dt>{{ t('syncSources.fields.authMechanism') }}</dt>
          <dd>{{ source.authMechanism.toUpperCase() }}</dd>
        </div>
        <div>
          <dt>{{ t('syncSources.fields.scope') }}</dt>
          <dd>{{ t(`syncSources.scopes.${source.scope}`) }}</dd>
        </div></DataCardFields
      ><template #details
        ><DataCardFields
          ><div>
            <dt>{{ t('syncSources.fields.description') }}</dt>
            <dd class="whitespace-pre-wrap wrap-anywhere">{{ source.description || '—' }}</dd>
          </div>
          <div>
            <dt>{{ t('syncSources.fields.createdBy') }}</dt>
            <dd>{{ source.createdBy || '—' }}</dd>
          </div>
          <div>
            <dt>{{ t('syncSources.targets') }}</dt>
            <dd class="wrap-anywhere">
              {{ [...source.domains, ...source.users].join(', ') || '—' }}
            </dd>
          </div></DataCardFields
        >
        <p v-if="source.oauth?.refreshFailed" class="text-sm text-danger">
          {{ t('syncSources.refreshFailed') }}
        </p></template
      ></DataCard
    >
  </ul>
</template>
