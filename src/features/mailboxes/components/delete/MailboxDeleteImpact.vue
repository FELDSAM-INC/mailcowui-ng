<script setup lang="ts">
// The body of legacy's deletion confirmation (`footer.delete_these_items` and the item), followed
// by what the deletion does, from the deletion preview (FR-045): the mail moved to the garbage area
// and when it is purged, the records and settings removed with the mailbox, and the aliases that
// are deleted or keep their other recipients. A notice says when the mailbox changed meanwhile.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'

import type { DeletionImpact } from '../../deletion'

const props = defineProps<{ impact: DeletionImpact; readable: string; notice?: string }>()
const { t } = useI18n()
const fmt = useFormat()

const retention = computed(() =>
  fmt.number(props.impact.retention.value, {
    style: 'unit',
    unit: props.impact.retention.unit,
    unitDisplay: 'long',
  }),
)
</script>

<template>
  <div class="flex flex-col gap-3 text-sm text-gray-700 dark:text-gray-300">
    <p
      v-if="notice"
      role="status"
      class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      {{ notice }}
    </p>
    <p>{{ lt('footer.delete_these_items') }}</p>
    <ul class="list-disc ps-5">
      <li data-delete-item class="font-medium wrap-anywhere text-gray-900 dark:text-white">
        {{ readable }}
      </li>
    </ul>
    <p data-impact="mail">
      {{
        t('mailboxes.delete.mail', {
          size: fmt.bytes(impact.mail.storageUsed),
          count: fmt.number(impact.mail.messageCount),
          retention,
        })
      }}
    </p>
    <template v-if="impact.counts.length > 0 || impact.present.length > 0">
      <p>{{ t('mailboxes.delete.removed') }}</p>
      <ul class="flex list-disc flex-col gap-1 ps-5">
        <li v-for="item in impact.counts" :key="item.kind" :data-impact="item.kind">
          {{ t(`mailboxes.delete.count.${item.kind}`, { count: fmt.number(item.count) }) }}
        </li>
        <li v-for="kind in impact.present" :key="kind" :data-impact="kind">
          {{ t(`mailboxes.delete.present.${kind}`) }}
        </li>
      </ul>
    </template>
    <div
      v-for="group in (['exclusiveAliases', 'sharedAliases'] as const).filter(
        (key) => impact[key].count > 0,
      )"
      :key="group"
      :data-impact="group"
    >
      <p>{{ t(`mailboxes.delete.${group}`, { count: fmt.number(impact[group].count) }) }}</p>
      <div
        role="region"
        tabindex="0"
        :aria-label="t(`mailboxes.delete.${group}`, { count: fmt.number(impact[group].count) })"
        class="max-h-32 overflow-y-auto rounded-lg focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <ul class="flex list-disc flex-col gap-0.5 ps-5 text-gray-700 dark:text-gray-300">
          <li
            v-for="address in impact[group].addresses"
            :key="address"
            class="wrap-anywhere text-gray-700 dark:text-gray-300"
          >
            {{ address }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
