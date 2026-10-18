<script setup lang="ts">
// Shortcuts to the sections visible to the account (FR-047), from the navigation catalogue, so
// they always match the navigation.
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { Identity } from '@/api'
import { visibleEntries } from '@/app/navigation/visibility'
import { ChevronRightIcon } from '@/shared/icons'

const props = defineProps<{ identity: Identity }>()
const { t } = useI18n()
const titleId = useId()
const entries = computed(() => visibleEntries(props.identity).filter((e) => e.id !== 'home'))
</script>

<template>
  <section data-shortcuts :aria-labelledby="titleId">
    <h2 :id="titleId" class="mb-3 font-semibold text-gray-900 dark:text-white">
      {{ t('home.shortcuts.heading') }}
    </h2>
    <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="entry in entries" :key="entry.id">
        <RouterLink
          :to="entry.path"
          class="surface flex min-h-11 items-center gap-3 p-4! font-medium text-gray-800 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-brand-500 sm:p-4! dark:text-gray-200 dark:hover:border-brand-500/40"
        >
          <component :is="entry.icon" class="size-5 shrink-0 text-gray-600 dark:text-gray-400" />
          <span class="min-w-0 flex-1 wrap-anywhere">{{ t(entry.labelKey) }}</span>
          <ChevronRightIcon class="size-4 shrink-0 text-gray-500" />
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
