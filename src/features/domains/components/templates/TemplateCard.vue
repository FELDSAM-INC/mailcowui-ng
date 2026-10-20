<script setup lang="ts">
// A template as a card below md (FR-050, FR-072), with the classic list's values in its order:
// the template name as heading with a link to its page and the Default mark, the limits, quotas,
// Global Address List, relay options and active state, the actions, and the rate limit, selector,
// key length and tags behind a disclosure. Slots: `select` and `actions`.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { DomainTemplate } from '@/api'
import { ChevronDownIcon } from '@/shared/icons'

import { useDomainFormat } from '../../format'
import DefaultBadge from './DefaultBadge.vue'
import { templateColumns } from './template-columns'
import TemplateEntryDetails from './TemplateEntryDetails.vue'

const props = defineProps<{ template: DomainTemplate }>()
const { t } = useI18n()
const format = useDomainFormat()
const expanded = ref(false)
const id = computed(() => `template-card-${props.template.id}`)
const columns = computed(() => templateColumns(format))
</script>

<template>
  <li
    :data-entry="template.id"
    class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
  >
    <article :aria-labelledby="`${id}-name`" class="flex flex-col gap-3">
      <div class="flex items-start gap-3">
        <slot name="select" />
        <div class="flex min-w-0 flex-1 flex-col items-start gap-1">
          <!-- eslint-disable-next-line vuejs-accessibility/heading-has-content -- the link is its content -->
          <h3 :id="`${id}-name`" class="text-base font-semibold text-gray-900 dark:text-white">
            <RouterLink
              :to="{ name: 'domain-template-detail', params: { templateId: template.id } }"
              class="inline-flex min-h-11 items-center break-words underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              {{ template.name }}
            </RouterLink>
          </h3>
          <DefaultBadge v-if="template.isDefault" />
        </div>
      </div>
      <dl class="grid grid-cols-1 gap-x-6 gap-y-1 text-sm">
        <div class="flex gap-1">
          <dt class="text-gray-600 dark:text-gray-400">{{ t('lists.id') }}:</dt>
          <dd class="text-gray-900 dark:text-white">{{ template.id }}</dd>
        </div>
        <div
          v-for="column in columns"
          :key="column.key"
          :data-column="column.key"
          class="flex flex-wrap gap-x-1"
        >
          <dt class="text-gray-600 dark:text-gray-400">{{ column.label }}:</dt>
          <dd class="text-gray-900 dark:text-white">{{ column.value(template) }}</dd>
        </div>
      </dl>
      <button
        type="button"
        class="inline-flex min-h-11 items-center gap-2 self-start rounded-lg px-2 text-sm font-medium text-accent-text bg-white dark:bg-gray-900 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
        :aria-expanded="expanded ? 'true' : 'false'"
        :aria-controls="`${id}-details`"
        :aria-label="t('domainTemplates.list.detailsOf', { name: template.name })"
        @click="expanded = !expanded"
      >
        <ChevronDownIcon
          class="size-4 motion-safe:transition-transform"
          :class="expanded ? 'rotate-180' : ''"
        />
        {{ t('domains.list.details') }}
      </button>
      <div v-if="expanded" :id="`${id}-details`" :data-entry-details="template.id">
        <TemplateEntryDetails :template="template" />
      </div>
      <slot name="actions" />
    </article>
  </li>
</template>
