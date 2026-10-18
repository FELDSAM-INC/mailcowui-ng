<script setup lang="ts">
// The full-page "service temporarily unavailable" state (spec edge case "API not ready", research
// R11). Its retry runs the bootstrap again.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { retryBootstrap } from '../bootstrap'

const { t } = useI18n()
const busy = ref(false)

async function retry() {
  if (busy.value) return
  busy.value = true
  try {
    await retryBootstrap()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main
    id="main"
    tabindex="-1"
    class="flex min-h-dvh items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-950"
  >
    <section
      class="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900"
      aria-labelledby="unavailable-title"
    >
      <h1
        id="unavailable-title"
        tabindex="-1"
        class="text-xl font-semibold text-gray-900 dark:text-white"
      >
        {{ t('states.serviceUnavailable.title') }}
      </h1>
      <p class="mt-3 text-gray-700 dark:text-gray-300">
        {{ t('states.serviceUnavailable.body') }}
      </p>
      <button
        type="button"
        class="mt-6 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-brand-500 px-5 font-medium text-white hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60"
        :disabled="busy"
        :aria-busy="busy"
        @click="retry"
      >
        {{ t('common.retry') }}
      </button>
    </section>
  </main>
</template>
