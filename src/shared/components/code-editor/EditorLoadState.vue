<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { lt } from '@/i18n'
import { buttonVariants } from '@/shared/ui/button'

// Vue supplies the failed import as `error`; do not render its internal URL or diagnostic.
defineProps<{ error?: Error }>()
const { t } = useI18n()
defineEmits<{ fallback: [] }>()
</script>
<template>
  <div
    v-if="error"
    data-editor-load-error
    role="alert"
    class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
  >
    <p>{{ t('codeEditor.loadFailed') }}</p>
    <button
      type="button"
      :class="buttonVariants({ variant: 'outline', class: 'mt-3' })"
      @click="$emit('fallback')"
    >
      {{ t('codeEditor.useBasic') }}
    </button>
  </div>
  <p
    v-else
    data-editor-loading
    role="status"
    aria-busy="true"
    class="min-h-90 rounded-lg border border-gray-300 p-4 dark:border-gray-600"
  >
    {{ lt('footer.loading') }}
  </p>
</template>
