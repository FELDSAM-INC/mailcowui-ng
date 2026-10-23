<script setup lang="ts">
// A compact theme menu retains all three choices, including following the device.
import { useI18n } from 'vue-i18n'
import { themeValues } from '@/api'
import { MonitorIcon, MoonIcon, SunIcon } from '@/shared/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { usePreferencesStore } from './store'
import { usePreferenceChoice } from './sync'

const { t } = useI18n()
const prefs = usePreferencesStore()
const { chooseTheme } = usePreferenceChoice()
const icons = { light: SunIcon, dark: MoonIcon, system: MonitorIcon }
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger
      data-theme-select
      :aria-label="t('preferences.theme')"
      :title="`${t('preferences.theme')}: ${t(`themes.${prefs.theme}`)}`"
      class="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
    >
      <component :is="icons[prefs.theme]" class="size-5" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" :collision-padding="8" class="min-w-48">
      <DropdownMenuRadioGroup :model-value="prefs.theme" :aria-label="t('preferences.theme')">
        <DropdownMenuRadioItem
          v-for="theme in themeValues"
          :key="theme"
          :value="theme"
          class="min-h-11 data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground dark:data-[state=checked]:bg-accent dark:data-[state=checked]:text-accent-foreground"
          @select="chooseTheme(theme)"
        >
          <component :is="icons[theme]" class="size-5" />
          {{ t(`themes.${theme}`) }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
