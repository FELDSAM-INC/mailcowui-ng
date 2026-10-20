<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CopyButton from '@/shared/components/CopyButton.vue'
defineProps<{ script: string }>()
const { t } = useI18n()
const code = ref<HTMLElement | null>(null)
</script>
<template>
  <div class="flex min-w-0 flex-col items-start gap-3">
    <CopyButton :text="script" :label="t('secrets.copy')" :select-target="code" />
    <pre
      ref="code"
      class="max-h-96 w-full overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
      tabindex="0"
    ><code>{{ script }}</code></pre>
  </div>
</template>
