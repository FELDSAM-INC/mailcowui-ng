<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { announce } from '@/shared/composables/useAnnouncer'
import { CloseIcon } from '@/shared/icons'
import { useSessionStore } from '../session/store'
const { t } = useI18n()
const route = useRoute()
const session = useSessionStore()
const message = computed(() => (session.shellNotice ? t(session.shellNotice.key) : ''))
watch(
  () => session.shellNotice,
  (notice) => {
    if (notice)
      announce(
        `${message.value}${notice.refusedWrite ? ` ${t('acting.notice.writeNotCarriedOut')}` : ''}`,
        { assertive: true },
      )
  },
)
watch(
  () => route.fullPath,
  () => {
    session.shellNotice = null
  },
)
</script>
<template>
  <div
    v-if="session.shellNotice"
    role="alert"
    class="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
  >
    <div class="min-w-0 flex-1">
      <p>{{ message }}</p>
      <p v-if="session.shellNotice.refusedWrite">{{ t('acting.notice.writeNotCarriedOut') }}</p>
    </div>
    <button
      type="button"
      class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-current"
      :aria-label="t('shellNotice.dismiss')"
      @click="session.shellNotice = null"
    >
      <CloseIcon class="size-5" />
    </button>
  </div>
</template>
