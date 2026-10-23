<script setup lang="ts">
// The shell header (FR-042, FR-046, research R21): the drawer button below lg, the operator's
// logo, and the actions slot (the apps menu and the user menu).
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { MenuIcon, MenuTwoIcon } from '@/shared/icons'

import BrandLogo from './BrandLogo.vue'

defineProps<{ desktop: boolean; menuOpen: boolean; homePath: string }>()
defineEmits<{ openMenu: [] }>()
const { t } = useI18n()
const menuButton = ref<HTMLButtonElement | null>(null)
defineExpose({ menuButton })
</script>

<template>
  <header
    class="flex h-16 items-center gap-2 border-b border-gray-200 bg-white px-2 sm:px-4 dark:border-gray-800 dark:bg-gray-900"
  >
    <button
      ref="menuButton"
      type="button"
      class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/5"
      :aria-label="
        t(
          desktop
            ? menuOpen
              ? 'a11y.collapseNavigation'
              : 'a11y.expandNavigation'
            : 'a11y.openNavigation',
        )
      "
      :aria-expanded="menuOpen ? 'true' : 'false'"
      :aria-haspopup="desktop ? undefined : 'dialog'"
      :aria-controls="desktop ? 'desktop-navigation' : undefined"
      data-navigation-toggle
      @click="$emit('openMenu')"
    >
      <MenuTwoIcon v-if="desktop" class="h-3 w-4 rtl:-scale-x-100" />
      <MenuIcon v-else class="size-6" />
    </button>
    <RouterLink
      v-if="!desktop"
      :to="homePath"
      data-shell-logo
      class="flex min-h-11 min-w-0 items-center rounded-lg px-1 focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      <BrandLogo class="max-w-full" text-class="truncate" />
    </RouterLink>
    <div class="ms-auto flex shrink-0 items-center gap-1">
      <slot name="actions" />
    </div>
  </header>
</template>
