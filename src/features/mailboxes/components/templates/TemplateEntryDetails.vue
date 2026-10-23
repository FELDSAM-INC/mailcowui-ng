<script setup lang="ts">
// The values of a template entry that the classic list keeps in its child row (FR-058,
// `js/site/mailbox.js` draw_templates_mbox_table): the quarantine notification and category, the
// forced password update, the rate limit ("∞" without one) and the tags, after the columns a
// narrower table leaves out (`hidden`).
import { computed } from 'vue'
import YesNoMark from '@/shared/components/YesNoMark.vue'

import { lt } from '@/i18n'

import { useTemplateDisplay } from '../../templates/display'
import type { MailboxTemplate } from '../../types'
import type { TemplateColumn } from './template-columns'

const props = withDefaults(
  defineProps<{ template: MailboxTemplate; hidden?: readonly TemplateColumn['key'][] }>(),
  { hidden: () => [] },
)
const display = useTemplateDisplay()
const columns = computed(() =>
  display.columns().filter((column) => props.hidden.includes(column.key)),
)
const items = computed(() => [
  {
    key: 'quarantineNotification',
    label: lt('mailbox.quarantine_notification'),
    value: display.option('quarantineNotification', props.template.quarantineNotification),
  },
  {
    key: 'quarantineCategory',
    label: lt('mailbox.quarantine_category'),
    value: display.option('quarantineCategory', props.template.quarantineCategory),
  },
  {
    key: 'forcePasswordChange',
    label: lt('mailbox.force_pw_update'),
    value: props.template.forcePasswordChange,
  },
  {
    key: 'rateLimit',
    label: lt('edit.ratelimit'),
    value: display.rateLimit(props.template.rateLimit),
  },
])
</script>

<template>
  <dl class="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
    <div v-for="column in columns" :key="column.key" :data-column="column.key">
      <dt class="text-gray-600 dark:text-gray-400">{{ column.label }}</dt>
      <dd class="text-gray-900 dark:text-white">{{ column.value(template) }}</dd>
    </div>
    <div v-for="item in items" :key="item.key" :data-column="item.key">
      <dt class="text-gray-600 dark:text-gray-400">{{ item.label }}</dt>
      <dd class="break-words text-gray-900 dark:text-white">
        <YesNoMark v-if="typeof item.value === 'boolean'" :value="item.value" /><template v-else>{{
          item.value
        }}</template>
      </dd>
    </div>
    <div data-column="tags">
      <dt class="text-gray-600 dark:text-gray-400">{{ lt('add.tags') }}</dt>
      <dd class="text-gray-900 dark:text-white">
        <ul v-if="template.tags.length > 0" class="flex flex-wrap gap-1.5">
          <li
            v-for="tag in template.tags"
            :key="tag"
            class="rounded-lg bg-gray-100 px-2 py-0.5 break-all text-gray-800 dark:bg-gray-800 dark:text-gray-200"
          >
            {{ tag }}
          </li>
        </ul>
      </dd>
    </div>
  </dl>
</template>
