<script setup lang="ts">
// The theme choice (FR-058, FR-062): light, dark or the device setting, as a native <select>.
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { themeValues, type Theme } from '@/api'

import { usePreferencesStore } from './store'
import { usePreferenceChoice } from './sync'

const { t } = useI18n()
const id = useId()
const prefs = usePreferencesStore()
const { chooseTheme } = usePreferenceChoice()

function onChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as Theme
  if ((themeValues as readonly string[]).includes(value)) void chooseTheme(value)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <label :for="id" class="text-sm text-gray-700 dark:text-gray-300">
      {{ t('preferences.theme') }}
    </label>
    <select :id="id" :value="prefs.theme" class="form-control w-auto" @change="onChange">
      <option v-for="theme in themeValues" :key="theme" :value="theme">
        {{ t(`themes.${theme}`) }}
      </option>
    </select>
  </div>
</template>
