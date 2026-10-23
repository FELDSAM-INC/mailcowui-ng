<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'

// The values of a template entry that the classic list keeps in its child row (FR-050,
// `js/site/mailbox.js` draw_templates_domain_table): rate limit, selector, DKIM key length and
// tags, plus the columns a narrower table leaves out (`hidden`).
import { computed } from 'vue'
import { lt } from '@/i18n'
import type { DomainTemplate } from '@/api'

import { useDomainFormat } from '../../format'
import { templateColumns, type TemplateColumn } from './template-columns'

const props = withDefaults(
  defineProps<{ template: DomainTemplate; hidden?: readonly TemplateColumn['key'][] }>(),
  { hidden: () => [] },
)
const format = useDomainFormat()
const columns = computed(() =>
  templateColumns(format).filter((column) => props.hidden.includes(column.key)),
)
const rateLimit = computed(() =>
  props.template.rateLimit
    ? `${format.count(props.template.rateLimit.value)} ${lt(`ratelimit.${props.template.rateLimit.frame}`)}`
    : `∞ ${lt('ratelimit.second')}`,
)
</script>

<template>
  <dl class="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
    <div v-for="column in columns" :key="column.key" :data-column="column.key">
      <dt class="text-gray-600 dark:text-gray-400">{{ column.label }}</dt>
      <dd class="break-words text-gray-900 dark:text-white">{{ column.value(template) }}</dd>
    </div>
    <div>
      <dt class="text-gray-600 dark:text-gray-400">{{ lt('edit.ratelimit') }}</dt>
      <dd class="text-gray-900 dark:text-white">{{ rateLimit }}</dd>
    </div>
    <div>
      <dt class="text-gray-600 dark:text-gray-400">
        {{ lt('mailbox.dkim_domains_selector') }}
      </dt>
      <dd class="break-all text-gray-900 dark:text-white">{{ template.dkimSelector }}</dd>
    </div>
    <div>
      <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.dkim_key_length') }}</dt>
      <dd class="text-gray-900 dark:text-white">{{ format.count(template.dkimKeySize) }}</dd>
    </div>
    <div>
      <dt class="text-gray-600 dark:text-gray-400">{{ lt('add.tags') }}</dt>
      <dd class="text-gray-900 dark:text-white">
        <ul v-if="template.tags.length > 0" class="flex flex-wrap gap-1.5">
          <li v-for="tag in template.tags" :key="tag">
            <Badge>{{ tag }}</Badge>
          </li>
        </ul>
      </dd>
    </div>
  </dl>
</template>
