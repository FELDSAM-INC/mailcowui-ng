<script setup lang="ts">
// The errors of one MTA-STS form field, referenced by the control's `aria-describedby`.
import { useI18n } from 'vue-i18n'

defineProps<{ id: string; messages: readonly string[] }>()
const { t } = useI18n()
</script>

<template>
  <div v-if="messages.length > 0" :id="id" class="text-sm text-red-700 dark:text-red-300">
    <p v-for="(message, index) in messages" :key="index" class="break-words">
      <span class="sr-only">{{ `${t('a11y.errorPrefix')} ` }}</span
      >{{ message }}
    </p>
  </div>
</template>
