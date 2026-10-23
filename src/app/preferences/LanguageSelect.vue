<script setup lang="ts">
// Public language menu: native language names and flags, with the current choice on its trigger.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDownIcon } from '@/shared/icons'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import LanguageOptions from './LanguageOptions.vue'
import { localeFlag } from './locale-flag'
import { usePreferencesStore } from './store'

const { t } = useI18n()
const prefs = usePreferencesStore()
const currentLanguage = computed(() =>
  prefs.availableLanguages.find((language) => language.code === prefs.locale),
)
</script>

<template>
  <DropdownMenu v-if="prefs.showLanguageChoice">
    <DropdownMenuTrigger
      data-language-select
      :aria-label="t('preferences.language')"
      :title="currentLanguage?.name"
      class="inline-flex min-h-11 max-w-60 min-w-0 items-center gap-2 rounded-full border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
    >
      <span aria-hidden="true" class="shrink-0 text-lg">{{ localeFlag(prefs.locale) }}</span>
      <span class="truncate">{{ currentLanguage?.name ?? prefs.locale }}</span>
      <ChevronDownIcon class="size-4 shrink-0" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" :collision-padding="8" class="w-72 max-w-[calc(100vw-2rem)]">
      <LanguageOptions />
    </DropdownMenuContent>
  </DropdownMenu>
</template>
