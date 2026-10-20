<script setup lang="ts">
// TailAdmin's header theme switch remains available without opening the account menu.
import { useI18n } from 'vue-i18n'
import { MoonIcon, SunIcon } from '@/shared/icons'
import { darkMode } from './theme'
import { usePreferenceChoice } from './sync'

const { t } = useI18n()
const { chooseTheme } = usePreferenceChoice()
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-label="t('themes.dark')"
    :aria-checked="darkMode"
    :title="t('preferences.theme')"
    class="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/5"
    @click="chooseTheme(darkMode ? 'light' : 'dark')"
  >
    <SunIcon v-if="darkMode" class="size-5" />
    <MoonIcon v-else class="size-5" />
  </button>
</template>
