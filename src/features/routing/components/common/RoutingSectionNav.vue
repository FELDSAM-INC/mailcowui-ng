<script setup lang="ts">
// The Routing section's screens (research R2), labelled with the classic tab names: below md a
// disclosure that names the current screen, from md up a wrapping row of links; the current one
// has `aria-current="page"`. Nothing scrolls sideways (constitution II).
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { lt } from '@/i18n'
import { ChevronDownIcon } from '@/shared/icons'

import { useRoutingIdentity } from '../../composables/useRoutingIdentity'
import type { RoutingScreenId } from '../../screens'

const props = defineProps<{ current: RoutingScreenId }>()
const { screens } = useRoutingIdentity()
const currentLabel = computed(() => {
  const screen = screens.value.find((item) => item.id === props.current)
  return screen ? lt(screen.labelKey) : ''
})
const open = ref(false)
const LINK =
  'inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 aria-[current=page]:bg-brand-50 aria-[current=page]:text-brand-700 dark:text-gray-300 dark:hover:bg-white/5 dark:aria-[current=page]:bg-brand-500/15 dark:aria-[current=page]:text-brand-300'
</script>

<template>
  <nav v-if="screens.length > 1" :aria-label="lt('admin.routing')" data-routing-nav>
    <button
      type="button"
      class="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 text-start text-sm font-medium text-gray-800 md:hidden dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
      :aria-expanded="open ? 'true' : 'false'"
      aria-controls="routing-nav-links"
      @click="open = !open"
    >
      <span class="min-w-0 wrap-anywhere">{{ currentLabel }}</span>
      <ChevronDownIcon
        class="size-4 shrink-0 motion-safe:transition-transform"
        :class="open ? 'rotate-180' : ''"
      />
    </button>
    <ul
      id="routing-nav-links"
      class="mt-2 flex-col gap-1 md:mt-0 md:flex md:flex-row md:flex-wrap"
      :class="open ? 'flex' : 'hidden'"
    >
      <li v-for="screen in screens" :key="screen.id">
        <RouterLink
          :to="{ name: screen.routeName }"
          :class="LINK"
          :aria-current="screen.id === current ? 'page' : undefined"
        >
          {{ lt(screen.labelKey) }}
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
