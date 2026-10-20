<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
defineProps<{ id?: string }>()
</script>
<template>
  <p
    :id="id"
    class="rounded-lg border border-warning-300 bg-warning-50 p-3 text-warning-900 dark:border-warning-700 dark:bg-warning-950 dark:text-warning-100"
  >
    {{ t('problem.not-allowed-while-impersonating') }}
  </p>
</template>
