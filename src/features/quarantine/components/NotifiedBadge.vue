<script setup lang="ts">
// Whether a notification included the item (UI 006 FR-010, legacy form map screen 1): legacy's
// "✔" and "✖" (`&#10004;`, `&#10006;`), with "Yes" or "No" for assistive technology.
import { useI18n } from 'vue-i18n'

defineProps<{ notified: boolean }>()
const { t } = useI18n()
</script>

<template>
  <span :data-notified="notified ? 'true' : 'false'" class="text-gray-900 dark:text-white">
    <span aria-hidden="true">{{ notified ? '✔' : '✖' }}</span>
    <span class="sr-only">{{ t(notified ? 'lists.filters.yes' : 'lists.filters.no') }}</span>
  </span>
</template>
