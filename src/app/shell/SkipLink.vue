<script setup lang="ts">
// The skip link to the main content (WCAG 2.4.1, research R21). Visible when focused.
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

function skip(event: MouseEvent) {
  const main = document.getElementById('main')
  if (!main) return
  event.preventDefault()
  main.focus()
}
</script>

<template>
  <a
    href="#main"
    class="sr-only z-200 rounded-lg bg-white px-4 py-3 font-medium text-accent-text bg-white dark:bg-gray-900 shadow-theme-lg focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:outline-2 focus:outline-brand-500 dark:bg-gray-900"
    @click="skip"
  >
    {{ t('a11y.skipToContent') }}
  </a>
</template>
