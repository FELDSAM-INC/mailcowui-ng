<script setup lang="ts">
// The app's own sign-in return addresses (FR-027), one per host name of the server, from the
// capabilities: the provider must allow them for single sign-on in this app, next to the classic
// interface's redirect URL. Read-only text with a copy button each, never links (FR-082); a
// refused clipboard selects the address for manual copying (FR-076).
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { announce } from '@/shared/composables/useAnnouncer'
import { CopyIcon } from '@/shared/icons'
import { copyText } from '@/shared/platform/clipboard'

import { HELP, ICON_BUTTON } from './styles'

const props = defineProps<{ idPrefix: string; urls: readonly string[] }>()
const { t } = useI18n()
const refused = ref(false)

async function copy(url: string, index: number) {
  if ((await copyText(url)) === 'copied') {
    refused.value = false
    announce(t('secrets.copied'))
    return
  }
  refused.value = true
  const field = document.getElementById(`${props.idPrefix}-app-return-${index}`)
  if (field instanceof HTMLInputElement) {
    field.focus()
    field.select()
  }
  announce(t('identityProvider.copyRefused'), { assertive: true })
}
</script>

<template>
  <div v-if="urls.length > 0" data-app-return-urls class="flex flex-col gap-2">
    <p
      :id="`${idPrefix}-app-return-label`"
      class="text-sm font-medium text-gray-800 dark:text-gray-200"
    >
      {{ t('identityProvider.appReturnUrls') }}
    </p>
    <ul class="flex flex-col gap-2" :aria-labelledby="`${idPrefix}-app-return-label`">
      <li v-for="(url, index) in urls" :key="url" class="flex gap-2">
        <input
          :id="`${idPrefix}-app-return-${index}`"
          :value="url"
          readonly
          :aria-labelledby="`${idPrefix}-app-return-label`"
          class="h-11 w-full min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-3 font-mono text-sm text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
        />
        <button
          type="button"
          :class="ICON_BUTTON"
          :aria-label="`${t('secrets.copy')}: ${url}`"
          @click="copy(url, index)"
        >
          <CopyIcon class="size-5" />
        </button>
      </li>
    </ul>
    <p v-if="refused" role="alert" :class="HELP">{{ t('identityProvider.copyRefused') }}</p>
  </div>
</template>
