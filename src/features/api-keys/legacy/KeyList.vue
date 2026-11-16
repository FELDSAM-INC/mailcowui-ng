<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { lt, text } from '@/i18n'
import ActiveBadge from '@/shared/components/ActiveBadge.vue'
import DataIdentity from '@/shared/components/DataIdentity.vue'
import DataRow from '@/shared/components/DataRow.vue'
import DataTableHeader from '@/shared/components/DataTableHeader.vue'
import DataCard from '@/shared/components/DataCard.vue'
import DataCardFields from '@/shared/components/DataCardFields.vue'
import RowControls from '@/shared/components/RowControls.vue'
import RowAction from '@/shared/components/RowAction.vue'
import { Badge } from '@/shared/ui/badge'
import { useDataColumns } from '@/shared/composables/useDataList'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import type { LegacyKey } from './api'
defineProps<{ entries: readonly LegacyKey[] }>()
const { t } = useI18n(),
  wide = useMediaQuery('(min-width: 768px)'),
  expanded = ref<number[]>([])
const columns = computed(() =>
  ['description', 'prefix', 'accessLevel', 'allowedNetworks'].map((id) => ({
    id,
    label: t(`legacyKeys.fields.${id}`),
    sort: ['description', 'accessLevel'].includes(id) ? id : undefined,
  })),
)
const table = useDataColumns(columns)
const link = (entry: LegacyKey) => ({
  name: 'legacy-api-key-detail',
  params: { legacyKeyId: entry.id },
})
const network = (entry: LegacyKey) =>
  entry.skipIpCheck ? t('legacyKeys.anyNetwork') : entry.allowedNetworks.join(', ')
const name = (entry: LegacyKey) => entry.description || `#${entry.id}`
const toggle = (id: number) => {
  expanded.value = expanded.value.includes(id)
    ? expanded.value.filter((v) => v !== id)
    : [...expanded.value, id]
}
</script>
<template>
  <div v-if="wide" class="table-frame">
    <table class="data-table w-full">
      <caption class="sr-only">
        {{
          t('legacyKeys.title')
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
        <template v-for="entry in entries" :key="entry.id"
          ><DataRow :to="link(entry)"
            ><td v-show="table.visible('description')">
              <DataIdentity
                >{{ name(entry)
                }}<template #badges
                  ><ActiveBadge :active="entry.active" /><Badge v-if="entry.service" color="info">{{
                    t('legacyKeys.service')
                  }}</Badge></template
                ></DataIdentity
              >
            </td>
            <td v-show="table.visible('prefix')">
              <code>{{ entry.prefix }}…</code>
            </td>
            <td v-show="table.visible('accessLevel')">
              {{ text(`enums.apiKeyAccessLevel.${entry.accessLevel}`) }}
            </td>
            <td v-show="table.visible('allowedNetworks')" class="wrap-anywhere">
              {{ network(entry) }}
            </td>
            <td class="table-controls-cell">
              <RowControls
                :expanded="expanded.includes(entry.id)"
                :controls="`legacy-key-${entry.id}`"
                :label="t('domains.list.detailsOf', { name: name(entry) })"
                @toggle="toggle(entry.id)"
                ><RowAction :menu="false" :to="link(entry)" :label="name(entry)">{{
                  entry.service ? t('legacyKeys.view') : lt('mailbox.edit')
                }}</RowAction></RowControls
              >
            </td></DataRow
          >
          <tr v-if="expanded.includes(entry.id)" :id="`legacy-key-${entry.id}`">
            <td :colspan="table.visibleCount.value + 1">
              <p class="text-sm text-muted">
                {{ entry.service ? t('legacyKeys.locked') : t('legacyKeys.intro') }}
              </p>
            </td>
          </tr></template
        >
      </tbody>
    </table>
  </div>
  <ul v-else class="space-y-3" :aria-label="t('legacyKeys.title')">
    <DataCard v-for="entry in entries" :key="entry.id" :title="name(entry)" :to="link(entry)"
      ><template #badges
        ><ActiveBadge :active="entry.active" /><Badge v-if="entry.service" color="info">{{
          t('legacyKeys.service')
        }}</Badge></template
      ><template #actions
        ><RowAction :menu="false" :to="link(entry)" :label="name(entry)">{{
          entry.service ? t('legacyKeys.view') : lt('mailbox.edit')
        }}</RowAction></template
      ><DataCardFields
        ><div>
          <dt>{{ t('legacyKeys.fields.accessLevel') }}</dt>
          <dd>{{ text(`enums.apiKeyAccessLevel.${entry.accessLevel}`) }}</dd>
        </div>
        <div>
          <dt>{{ t('legacyKeys.fields.prefix') }}</dt>
          <dd>
            <code>{{ entry.prefix }}…</code>
          </dd>
        </div></DataCardFields
      ><template #details
        ><DataCardFields
          ><div>
            <dt>{{ t('legacyKeys.fields.allowedNetworks') }}</dt>
            <dd class="wrap-anywhere">{{ network(entry) }}</dd>
          </div></DataCardFields
        >
        <p v-if="entry.service" class="text-sm text-muted">
          {{ t('legacyKeys.locked') }}
        </p></template
      ></DataCard
    >
  </ul>
</template>
