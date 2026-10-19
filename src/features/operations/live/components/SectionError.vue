<script setup lang="ts">
// A dashboard section that could not be loaded (FR-025): its own message and retry, so that one
// failing section never hides the others. A section that already shows values keeps them when a
// refresh fails; the live-update bar then says that updating failed (FR-023).
import { useI18n } from 'vue-i18n'

import { DangerIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

defineEmits<{ retry: [] }>()
const { t } = useI18n()
</script>

<template>
  <div
    data-section-error
    class="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
  >
    <p class="flex items-start gap-2">
      <DangerIcon class="mt-0.5 size-5 shrink-0" />
      <span>{{ t('operations.dashboard.sectionError') }}</span>
    </p>
    <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="$emit('retry')">
      {{ t('common.retry') }}
    </button>
  </div>
</template>
