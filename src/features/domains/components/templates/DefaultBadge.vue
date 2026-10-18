<script setup lang="ts">
// The mark of the Default template (FR-049), as text.
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <span
    data-default-badge
    class="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-900 dark:bg-sky-950 dark:text-sky-100"
  >
    {{ t('domainTemplates.default') }}
  </span>
</template>
