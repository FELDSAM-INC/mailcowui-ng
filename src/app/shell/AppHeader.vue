<script setup lang="ts">
// The shell header (FR-042, FR-046, research R21): the drawer button below lg, the operator's
// logo, and the actions slot (the apps menu and the user menu).
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { MenuIcon } from '@/shared/icons'

import BrandLogo from './BrandLogo.vue'

defineProps<{ showMenuButton: boolean; menuOpen: boolean }>()
defineEmits<{ openMenu: [] }>()
const { t } = useI18n()
const menuButton = ref<HTMLButtonElement | null>(null)
defineExpose({ menuButton })
</script>

<template>
  <header
    class="sticky top-0 z-50 flex h-16 items-center gap-2 border-b border-gray-200 bg-white px-2 sm:px-4 dark:border-gray-800 dark:bg-gray-900"
  >
    <button
      v-if="showMenuButton"
      ref="menuButton"
      type="button"
      class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-white/5"
      :aria-label="t('a11y.openNavigation')"
      :aria-expanded="menuOpen ? 'true' : 'false'"
      aria-haspopup="dialog"
      @click="$emit('openMenu')"
    >
      <MenuIcon class="size-6" />
    </button>
    <RouterLink
      to="/"
      class="flex min-h-11 min-w-0 items-center rounded-lg px-1 focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      <BrandLogo text-class="truncate" />
    </RouterLink>
    <div class="ms-auto flex shrink-0 items-center gap-1">
      <slot name="actions" />
    </div>
  </header>
</template>
