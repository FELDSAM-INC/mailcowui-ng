<script setup lang="ts">
import ActiveBadge from '@/shared/components/ActiveBadge.vue'

import DataCard from '@/shared/components/DataCard.vue'
import DataCardFields from '@/shared/components/DataCardFields.vue'
import YesNoMark from '@/shared/components/YesNoMark.vue'

// A template as a card below md (FR-050, FR-072), with the classic list's values in its order:
// the template name as heading with a link to its page and the Default mark, the limits, quotas,
// Global Address List, relay options and active state, the actions, and the rate limit, selector,
// key length and tags behind a disclosure. Slots: `select` and `actions`.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DomainTemplate } from '@/api'

import { useDomainFormat } from '../../format'
import DefaultBadge from './DefaultBadge.vue'
import { templateColumns } from './template-columns'
import TemplateEntryDetails from './TemplateEntryDetails.vue'

const props = defineProps<{ template: DomainTemplate }>()
const { t } = useI18n()
const format = useDomainFormat()
const id = computed(() => `template-card-${props.template.id}`)
const columns = computed(() => templateColumns(format))
const values = computed(() =>
  columns.value.filter((column) => typeof props.template[column.key] !== 'boolean'),
)
const flags = computed(() =>
  columns.value.filter((column) => typeof props.template[column.key] === 'boolean'),
)
</script>

<template>
  <DataCard
    :data-entry="template.id"
    :title-id="`${id}-name`"
    :title="template.name"
    :to="{ name: 'domain-template-detail', params: { templateId: template.id } }"
    :details-id="`${id}-details`"
    :details-label="t('domainTemplates.list.detailsOf', { name: template.name })"
  >
    <template #badges
      ><DefaultBadge v-if="template.isDefault" /><ActiveBadge :active="template.active"
    /></template>
    <template v-if="$slots.select" #select><slot name="select" /></template>
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    <DataCardFields>
      <div class="flex gap-1">
        <dt class="text-gray-600 dark:text-gray-400">{{ t('lists.id') }}:</dt>
        <dd class="text-gray-900 dark:text-white">{{ template.id }}</dd>
      </div>
      <div
        v-for="column in values"
        :key="column.key"
        :data-column="column.key"
        class="flex flex-wrap gap-x-1"
      >
        <dt class="text-gray-600 dark:text-gray-400">{{ column.label }}:</dt>
        <dd class="text-gray-900 dark:text-white">
          {{ column.value(template) }}
        </dd>
      </div>
    </DataCardFields>
    <DataCardFields inline>
      <div
        v-for="column in flags.filter((item) => item.key !== 'active')"
        :key="column.key"
        :data-column="column.key"
      >
        <dt>{{ column.label }}</dt>
        <dd><YesNoMark :value="Boolean(template[column.key])" /></dd>
      </div>
    </DataCardFields>
    <template #details>
      <TemplateEntryDetails :data-entry-details="template.id" :template="template" />
    </template>
  </DataCard>
</template>
