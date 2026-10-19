<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuarantineItem } from '@/api'
import { lt } from '@/i18n'
import PlainText from '@/shared/components/PlainText.vue'

const props = defineProps<{ items: readonly QuarantineItem[]; destructive: boolean }>()
const { t } = useI18n()
const virusCount = computed(() => props.items.filter((item) => item.virus).length)
</script>

<template>
  <div class="flex flex-col gap-3 text-gray-800 dark:text-gray-200">
    <p v-if="destructive">{{ lt('footer.delete_these_items') }}</p>
    <p>{{ t('bulk.selected', { count: items.length }) }}</p>
    <p v-if="virusCount > 0" class="font-semibold">
      {{ t('quarantineUi.bulk.virusCount', { count: virusCount }) }}
    </p>
    <ul class="flex flex-col gap-3">
      <li v-for="item in items" :key="item.id" class="min-w-0 wrap-anywhere">
        <p class="font-medium">
          {{ item.id }}:
          <PlainText :value="item.subject || '-'" class="text-gray-800 dark:text-gray-200" />
        </p>
        <p>
          {{ lt('quarantine.rcpt') }}:
          <PlainText :value="item.recipient" class="text-gray-800 dark:text-gray-200" />
        </p>
      </li>
    </ul>
  </div>
</template>
