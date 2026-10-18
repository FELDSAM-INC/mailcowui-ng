<script setup lang="ts">
// A one-shot message on the sign-in screen (data-model §4 `notice`): signed out, session ended,
// sign-in timed out, second factor rejected or unavailable. It is taken from the session store
// once, shown, and announced politely.
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSessionStore } from '@/app/session/store'
import { announce } from '@/shared/composables/useAnnouncer'
import { CheckIcon, InfoIcon } from '@/shared/icons'

const { t } = useI18n()
const notice = useSessionStore().consumeNotice()
const text = computed(() => (notice ? t(`auth.notice.${notice}`) : ''))

onMounted(() => {
  if (text.value) announce(text.value)
})
</script>

<template>
  <div
    v-if="notice"
    data-notice
    class="flex gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
  >
    <CheckIcon v-if="notice === 'signedOut'" class="mt-0.5 size-5 shrink-0" />
    <InfoIcon v-else class="mt-0.5 size-5 shrink-0" />
    <p class="min-w-0">{{ text }}</p>
  </div>
</template>
