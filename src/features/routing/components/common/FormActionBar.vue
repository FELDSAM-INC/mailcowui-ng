<script setup lang="ts">
// The action bar of a routing form (FR-011): sticky at the bottom of the viewport, so that the
// save action is reachable without scrolling back up; Cancel goes back to the list.
import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import { lt } from '@/i18n'
import { buttonVariants } from '@/shared/ui/button'

defineProps<{ submitLabel: string; pending: boolean; cancelTo: RouteLocationRaw }>()
const { t } = useI18n()
</script>

<template>
  <div
    data-sticky-save
    class="sticky bottom-0 z-10 -mx-4 flex flex-wrap gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 sm:-mx-5 sm:px-5 dark:border-gray-800 dark:bg-gray-900/95"
  >
    <button type="submit" :class="buttonVariants({ variant: 'default' })" :disabled="pending">
      {{ pending ? t('sections.saving') : submitLabel }}
    </button>
    <RouterLink :to="cancelTo" :class="buttonVariants({ variant: 'outline' })">
      {{ lt('footer.cancel') }}
    </RouterLink>
  </div>
</template>
