<script setup lang="ts">
// The navigation: the catalogue entries the identity may see (FR-043, research R19).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import type { Identity } from '@/api'

import type { NavigationEntry } from '../navigation/catalogue'
import { visibleEntries } from '../navigation/visibility'

const props = defineProps<{ identity: Identity | null | undefined }>()
defineEmits<{ navigate: [] }>()

const { t } = useI18n()
const route = useRoute()
const entries = computed(() => visibleEntries(props.identity))

function isCurrent(entry: NavigationEntry): boolean {
  if (route.meta.navEntry) return route.meta.navEntry === entry.id
  return entry.path === '/' ? route.path === '/' : route.path.startsWith(entry.path)
}
</script>

<template>
  <nav :aria-label="t('a11y.mainNavigation')">
    <ul class="flex flex-col gap-1">
      <li v-for="entry in entries" :key="entry.id">
        <RouterLink
          :to="entry.path"
          :aria-current="isCurrent(entry) ? 'page' : undefined"
          class="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 aria-[current=page]:bg-brand-50 aria-[current=page]:text-brand-700 dark:text-gray-300 dark:hover:bg-white/5 dark:aria-[current=page]:bg-brand-500/15 dark:aria-[current=page]:text-brand-300"
          @click="$emit('navigate')"
        >
          <component :is="entry.icon" class="size-5 shrink-0" />
          <span class="min-w-0 break-words">{{ t(entry.labelKey) }}</span>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
