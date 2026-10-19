<script setup lang="ts">
// The navigation: the catalogue entries the identity may see (FR-043, research R19). Consecutive
// entries of one group (UI 011: "System") are listed under the group's heading, as a labelled
// list, in the drawer and in the static navigation.
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import type { Identity } from '@/api'
import { resolveText, text } from '@/i18n'

import type { NavigationEntry } from '../navigation/catalogue'
import { visibleEntries } from '../navigation/visibility'

const props = defineProps<{ identity: Identity | null | undefined }>()
defineEmits<{ navigate: [] }>()

const { t } = useI18n()
const route = useRoute()
const groupId = useId()

type Item =
  | { kind: 'entry'; entry: NavigationEntry }
  | { kind: 'group'; group: NonNullable<NavigationEntry['group']>; entries: NavigationEntry[] }

const items = computed(() => {
  const result: Item[] = []
  for (const entry of visibleEntries(props.identity)) {
    const last = result.at(-1)
    if (!entry.group) result.push({ kind: 'entry', entry })
    else if (last?.kind === 'group' && last.group === entry.group) last.entries.push(entry)
    else result.push({ kind: 'group', group: entry.group, entries: [entry] })
  }
  return result
})

function isCurrent(entry: NavigationEntry): boolean {
  if (route.meta.navEntry) return route.meta.navEntry === entry.id
  return entry.path === '/' ? route.path === '/' : route.path.startsWith(entry.path)
}

const linkClass =
  'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 aria-[current=page]:bg-brand-50 aria-[current=page]:text-brand-700 dark:text-gray-300 dark:hover:bg-white/5 dark:aria-[current=page]:bg-brand-500/15 dark:aria-[current=page]:text-brand-300'
</script>

<template>
  <nav :aria-label="t('a11y.mainNavigation')">
    <ul class="flex flex-col gap-1">
      <template v-for="item in items" :key="item.kind === 'entry' ? item.entry.id : item.group">
        <li v-if="item.kind === 'entry'">
          <RouterLink
            :to="item.entry.path"
            :aria-current="isCurrent(item.entry) ? 'page' : undefined"
            :class="linkClass"
            @click="$emit('navigate')"
          >
            <component :is="item.entry.icon" class="size-5 shrink-0" />
            <span class="min-w-0 break-words">{{ resolveText(item.entry.labelKey, t) }}</span>
          </RouterLink>
        </li>
        <li v-else data-nav-group class="mt-3 flex flex-col gap-1">
          <h2
            :id="`${groupId}-${item.group}`"
            class="px-3 text-sm font-semibold text-gray-500 dark:text-gray-400"
          >
            {{ text(`nav.groups.${item.group}`) }}
          </h2>
          <ul :aria-labelledby="`${groupId}-${item.group}`" class="flex flex-col gap-1">
            <li v-for="entry in item.entries" :key="entry.id">
              <RouterLink
                :to="entry.path"
                :aria-current="isCurrent(entry) ? 'page' : undefined"
                :class="linkClass"
                @click="$emit('navigate')"
              >
                <component :is="entry.icon" class="size-5 shrink-0" />
                <span class="min-w-0 break-words">{{ resolveText(entry.labelKey, t) }}</span>
              </RouterLink>
            </li>
          </ul>
        </li>
      </template>
    </ul>
  </nav>
</template>
