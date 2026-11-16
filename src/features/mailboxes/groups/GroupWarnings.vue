<script setup lang="ts">
import { useI18n } from 'vue-i18n'
defineProps<{ warnings: readonly string[] }>()
const translator = useI18n()
const { t } = translator
function message(warning: string) {
  const [code, ...target] = warning.split(':')
  const key = `mailboxGroups.warnings.${code}`
  return translator.te(key)
    ? t(key, { target: target.join(':') })
    : t('mailboxGroups.warnings.generic')
}
</script>
<template>
  <div
    v-if="warnings.length"
    role="status"
    class="rounded-xl border border-line bg-surface p-4 text-sm"
  >
    <ul class="list-disc space-y-1 ps-5">
      <li v-for="warning in warnings" :key="warning">{{ message(warning) }}</li>
    </ul>
  </div>
</template>
