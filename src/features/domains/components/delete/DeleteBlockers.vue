<script setup lang="ts">
// Why a domain cannot be deleted (FR-042, US4-AS3): the mailboxes and resources that remain, with
// up to 100 of their addresses.
import { useI18n } from 'vue-i18n'

import type { DomainDeletionPreview } from '@/api'

defineProps<{ preview: DomainDeletionPreview }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-3 text-sm text-gray-700 dark:text-gray-300">
    <p>{{ t('domains.delete.blockersIntro') }}</p>
    <div v-if="preview.blockers.mailboxes.count > 0">
      <p class="font-medium text-gray-900 dark:text-white">
        {{ t('domains.delete.blockerMailboxes', { count: preview.blockers.mailboxes.count }) }}
      </p>
      <ul class="flex max-h-40 flex-col gap-0.5 overflow-y-auto ps-1">
        <li
          v-for="address in preview.blockers.mailboxes.addresses"
          :key="address"
          class="break-all text-gray-700 dark:text-gray-300"
        >
          {{ address }}
        </li>
      </ul>
    </div>
    <div v-if="preview.blockers.resources.count > 0">
      <p class="font-medium text-gray-900 dark:text-white">
        {{ t('domains.delete.blockerResources', { count: preview.blockers.resources.count }) }}
      </p>
      <ul class="flex max-h-40 flex-col gap-0.5 overflow-y-auto ps-1">
        <li
          v-for="address in preview.blockers.resources.addresses"
          :key="address"
          class="break-all text-gray-700 dark:text-gray-300"
        >
          {{ address }}
        </li>
      </ul>
    </div>
  </div>
</template>
