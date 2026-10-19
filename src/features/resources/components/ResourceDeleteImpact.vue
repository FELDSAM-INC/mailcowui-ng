<script setup lang="ts">
// The body of a resource deletion's confirmation (FR-029, research R11, US7-AS7), under legacy's
// `footer.delete_these_items`: the description and address, then that its calendar, bookings and
// sharing settings in the groupware are deleted (contract `deleteResource`).
import { useI18n } from 'vue-i18n'

import type { Resource } from '@/api'

defineProps<{ resource: Resource }>()
const { t } = useI18n()
</script>

<template>
  <div data-resource-delete class="flex flex-col gap-3 text-sm text-gray-700 dark:text-gray-300">
    <p class="font-medium break-all text-gray-900 dark:text-white">
      {{ resource.description }} ({{ resource.addressUnicode }})
    </p>
    <p>{{ t('resources.delete.impact') }}</p>
  </div>
</template>
