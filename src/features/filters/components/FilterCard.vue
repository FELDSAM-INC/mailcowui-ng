<script setup lang="ts">
import DataCard from '@/shared/components/DataCard.vue'
import DataCardFields from '@/shared/components/DataCardFields.vue'
import YesNoMark from '@/shared/components/YesNoMark.vue'
import RowAction from '@/shared/components/RowAction.vue'
import RowActions from '@/shared/components/RowActions.vue'

import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'
import type { SieveFilter } from '@/api'
import { lt } from '@/i18n'
import ScriptBlock from './ScriptBlock.vue'
defineProps<{
  item: SieveFilter
  location: RouteLocationRaw
  selecting: boolean
  selected: boolean
  canChange: boolean
  busy: boolean
}>()
defineEmits<{ toggle: []; remove: [] }>()
const { t } = useI18n()
</script>
<template>
  <DataCard
    as="article"
    :data-filter-id="item.id"
    :title="item.description"
    :to="location"
    :details-label="`${t('filters.columns.script')}: ${item.description}`"
  >
    <template v-if="selecting" #select>
      <label class="flex size-11 items-center justify-center">
        <span class="sr-only">{{ item.description }}</span>
        <input
          type="checkbox"
          class="size-5"
          :checked="selected"
          :disabled="busy"
          @change="$emit('toggle')"
        />
      </label>
    </template>
    <template #actions>
      <RowActions
        v-slot="{ menu }"
        :count="canChange ? 2 : 1"
        :label="`${lt('mailbox.action')}: ${item.description}`"
      >
        <RowAction
          :menu="menu"
          :to="location"
          :label="lt('mailbox.edit')"
          :aria-label="`${lt('mailbox.edit')}: ${item.description}`"
        />
        <RowAction
          v-if="canChange"
          :menu="menu"
          :disabled="busy"
          destructive
          :label="lt('mailbox.remove')"
          :aria-label="`${lt('mailbox.remove')}: ${item.description}`"
          @select="$emit('remove')"
        />
      </RowActions>
    </template>
    <DataCardFields>
      <div>
        <dt class="font-medium">{{ t('lists.id') }}</dt>
        <dd>{{ item.id }}</dd>
      </div>
      <div>
        <dt class="font-medium">{{ lt('mailbox.owner') }}</dt>
        <dd class="wrap-anywhere">{{ item.mailbox }}</dd>
      </div>

      <div>
        <dt class="font-medium">{{ t('filters.columns.type') }}</dt>
        <dd>{{ t(`filters.kind.${item.kind}`) }}</dd>
      </div>
      <div>
        <dt class="font-medium">{{ lt('mailbox.active') }}</dt>
        <dd><YesNoMark :value="item.active" /></dd>
      </div>
    </DataCardFields>
    <template #details><ScriptBlock :script="item.script" /></template>
  </DataCard>
</template>
