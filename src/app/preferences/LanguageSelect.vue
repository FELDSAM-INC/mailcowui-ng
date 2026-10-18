<script setup lang="ts">
// The language choice (FR-058, FR-060): a native <select> of the languages that are both enabled
// on the server and translated in the app, by their own names and without flags; hidden when there
// is nothing to choose. Each option carries its language for screen readers.
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { isAppLocale, toBcp47 } from '@/i18n/locales'

import { usePreferencesStore } from './store'
import { usePreferenceChoice } from './sync'

const { t } = useI18n()
const id = useId()
const prefs = usePreferencesStore()
const { chooseLocale } = usePreferenceChoice()

function onChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (isAppLocale(value)) void chooseLocale(value)
}
</script>

<template>
  <div v-if="prefs.showLanguageChoice" class="flex items-center gap-2">
    <label :for="id" class="text-sm text-gray-700 dark:text-gray-300">
      {{ t('preferences.language') }}
    </label>
    <select :id="id" :value="prefs.locale" class="form-control w-auto" @change="onChange">
      <option
        v-for="locale in prefs.availableLocales"
        :key="locale"
        :value="locale"
        :lang="toBcp47(locale)"
      >
        {{ t(`preferences.languages.${locale}`) }}
      </option>
    </select>
  </div>
</template>
