<script setup lang="ts">
// The automatic refresh's control (FR-014, WCAG 2.2.2), shown only while a listed job runs:
// "Pause automatic refresh" and "Resume automatic refresh", or, after the inactivity limit, the
// notice with "Resume". It announces nothing itself; the page announces the inactivity pause.
import { useI18n } from 'vue-i18n'

import { buttonVariants } from '@/shared/ui/button'

defineProps<{ visible: boolean; paused: boolean; inactive: boolean }>()
const emit = defineEmits<{ pause: []; resume: [] }>()
const { t } = useI18n()
</script>

<template>
  <div
    v-if="visible"
    data-auto-refresh
    class="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
  >
    <p class="me-auto">
      {{
        inactive
          ? t('syncJobs.refresh.inactive')
          : paused
            ? t('syncJobs.refresh.paused')
            : t('syncJobs.refresh.running')
      }}
    </p>
    <button
      v-if="inactive || paused"
      type="button"
      :class="buttonVariants({ variant: 'outline', size: 'sm' })"
      @click="emit('resume')"
    >
      {{ t('syncJobs.refresh.resume') }}
    </button>
    <button
      v-else
      type="button"
      :class="buttonVariants({ variant: 'outline', size: 'sm' })"
      @click="emit('pause')"
    >
      {{ t('syncJobs.refresh.pause') }}
    </button>
  </div>
</template>
