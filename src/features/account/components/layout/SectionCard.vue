<script setup lang="ts">
// One section on the hub (UI 005 research R4; decision D1): a link with the section's classic
// title, no summary (legacy has none).
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { resolveText } from '@/i18n'
import { ChevronRightIcon } from '@/shared/icons'

import type { AccountSection } from '../../sections'

defineProps<{ section: AccountSection }>()
const { t } = useI18n()
</script>

<template>
  <RouterLink
    :to="{ name: section.route! }"
    :data-section="section.id"
    class="surface flex min-h-11 items-center gap-3 p-4! font-medium text-gray-800 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-brand-500 sm:p-4! dark:text-gray-200 dark:hover:border-brand-500/40"
  >
    <span class="min-w-0 flex-1 wrap-anywhere">{{ resolveText(section.title, t) }}</span>
    <ChevronRightIcon class="size-4 shrink-0 text-gray-500" />
  </RouterLink>
</template>
