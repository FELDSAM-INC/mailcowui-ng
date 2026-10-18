<script setup lang="ts">
// Redirect URIs as wrapping text, never as links (FR-082). With `marks`, a stored URI that breaks
// the rules is marked with the rule (FR-061): the classic interface may have stored it.
import { useI18n } from 'vue-i18n'

import { WarningIcon } from '@/shared/icons'

import { isRedirectUri } from '../redirect-uris'

withDefaults(defineProps<{ uris: readonly string[]; marks?: boolean }>(), { marks: false })
const { t } = useI18n()
</script>

<template>
  <span v-if="uris.length === 0" class="text-gray-600 dark:text-gray-400">—</span>
  <ul v-else class="flex min-w-0 flex-col gap-1">
    <li v-for="(uri, index) in uris" :key="`${index}-${uri}`" class="min-w-0">
      <span class="wrap-anywhere">{{ uri }}</span>
      <span
        v-if="marks && !isRedirectUri(uri)"
        data-invalid-uri
        class="mt-0.5 flex items-start gap-1 text-sm text-amber-800 dark:text-amber-200"
      >
        <WarningIcon class="mt-0.5 size-4 shrink-0" />
        <span>{{ t('validation.format.redirectUri') }}</span>
      </span>
    </li>
  </ul>
</template>
