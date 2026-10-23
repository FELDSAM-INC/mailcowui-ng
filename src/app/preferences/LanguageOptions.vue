<script setup lang="ts">
// Shared by the public auth menu and the account menu.
import { useI18n } from 'vue-i18n'
import { toBcp47 } from '@/i18n/locales'
import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/shared/ui/dropdown-menu'
import { localeFlag } from './locale-flag'
import { usePreferencesStore } from './store'
import { usePreferenceChoice } from './sync'

const { t } = useI18n()
const prefs = usePreferencesStore()
const { chooseLocale } = usePreferenceChoice()
</script>

<template>
  <DropdownMenuRadioGroup :model-value="prefs.locale" :aria-label="t('preferences.language')">
    <DropdownMenuRadioItem
      v-for="language in prefs.availableLanguages"
      :key="language.code"
      :value="language.code"
      :lang="toBcp47(language.code)"
      class="min-h-11 data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground dark:data-[state=checked]:bg-accent dark:data-[state=checked]:text-accent-foreground"
      @select="chooseLocale(language.code)"
    >
      <span aria-hidden="true" data-language-flag class="text-lg">{{
        localeFlag(language.code)
      }}</span>
      {{ language.name }}
    </DropdownMenuRadioItem>
  </DropdownMenuRadioGroup>
</template>
