<script setup lang="ts">
// The mailbox templates of one page: cards below md and a table from md up (FR-058). The selection
// and entry action slots pass through to both layouts.
import { lt } from '@/i18n'
import type { SortOrder } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'

import type { TemplateSort } from '../../templates/list-state'
import type { MailboxTemplate } from '../../types'
import TemplateCard from './TemplateCard.vue'
import TemplateTable from './TemplateTable.vue'

withDefaults(
  defineProps<{
    templates: readonly MailboxTemplate[]
    sort: TemplateSort
    order: SortOrder
    selectable?: boolean
    actions?: boolean
  }>(),
  { selectable: false, actions: true },
)
const emit = defineEmits<{ sort: [sort: TemplateSort, order: SortOrder] }>()
const wide = useMediaQuery('(min-width: 768px)')
</script>

<template>
  <TemplateTable
    v-if="wide"
    :templates="templates"
    :sort="sort"
    :order="order"
    :selectable="selectable"
    :actions="actions"
    @sort="(key, order) => emit('sort', key, order)"
  >
    <template #select-all><slot name="select-all" /></template>
    <template #select="{ template }"><slot name="select" :template="template" /></template>
    <template #actions="{ template }"><slot name="actions" :template="template" /></template>
  </TemplateTable>
  <ul v-else :aria-label="lt('mailbox.mailbox_templates')" class="flex flex-col gap-3">
    <TemplateCard v-for="template in templates" :key="template.id" :template="template">
      <template v-if="selectable" #select><slot name="select" :template="template" /></template>
      <template v-if="actions" #actions><slot name="actions" :template="template" /></template>
    </TemplateCard>
  </ul>
</template>
