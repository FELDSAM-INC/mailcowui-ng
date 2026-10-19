<script setup lang="ts">
// The dashboard's live-update control (FR-018, FR-020, FR-021, FR-023; conventions "Polling"):
// the pause and resume button with its state in text, "paused since", the inactivity notice, the
// notice that the capabilities could not be read (with a retry), the notice that updating failed,
// and the manual refresh (legacy `admin.refresh`), which works in every state. Nothing here is a
// live region: automatic updates are never announced (FR-024).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import { WarningIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import type { LiveState } from '../useLiveUpdates'
import { PauseIcon, PlayIcon, RestartIcon } from '../../icons'

const props = defineProps<{
  state: LiveState
  since: number
  /** A refresh of a live section failed; the last values stay (FR-023). */
  failed: boolean
  refreshing: boolean
}>()
const emit = defineEmits<{ pause: []; resume: []; refresh: []; retryCapabilities: [] }>()
const { t } = useI18n()
const fmt = useFormat()

const notice = computed(() => {
  switch (props.state) {
    case 'paused':
      return t('operations.live.paused', { time: fmt.dateTime(props.since, 'time') })
    case 'inactive':
      return t('operations.live.inactive')
    case 'unavailable':
      return t('operations.live.unavailable')
    default:
      return ''
  }
})
const stopped = computed(() => props.state === 'paused' || props.state === 'inactive')
</script>

<template>
  <div
    data-live-updates
    class="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-800 sm:flex-row sm:flex-wrap sm:items-center dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
  >
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <p v-if="notice" data-live-notice class="wrap-anywhere">{{ notice }}</p>
      <p
        v-if="failed"
        data-live-failed
        class="flex items-start gap-2 text-warning-800 dark:text-warning-200"
      >
        <WarningIcon class="mt-0.5 size-4 shrink-0" />
        <span class="wrap-anywhere">{{ t('operations.live.failed') }}</span>
      </p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button
        v-if="state === 'unavailable'"
        type="button"
        :class="buttonVariants({ variant: 'outline', size: 'sm' })"
        @click="emit('retryCapabilities')"
      >
        {{ t('common.retry') }}
      </button>
      <button
        v-else-if="stopped"
        type="button"
        :class="buttonVariants({ variant: 'outline', size: 'sm' })"
        @click="emit('resume')"
      >
        <PlayIcon />
        {{ t('operations.live.resume') }}
      </button>
      <button
        v-else
        type="button"
        :class="buttonVariants({ variant: 'outline', size: 'sm' })"
        @click="emit('pause')"
      >
        <PauseIcon />
        {{ t('operations.live.pause') }}
      </button>
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline', size: 'sm' })"
        :aria-disabled="refreshing || undefined"
        @click="!refreshing && emit('refresh')"
      >
        <RestartIcon :class="refreshing ? 'motion-safe:animate-spin' : ''" />
        {{ lt('admin.refresh') }}
      </button>
    </div>
  </div>
</template>
