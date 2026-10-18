<script setup lang="ts">
// The passkey suggestion of the home screen (FR-047, FR-051): shown when the account has no
// passkey and the device supports passkeys, linking to "Passkeys". It can be dismissed on this
// device (`mailcowui-ng.passkey-suggestion-dismissed`, data-model §4), never per user, so that no
// username is stored. Without support nothing is requested.
import { useQuery } from '@tanstack/vue-query'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { passkeysListQuery } from '@/features/passkeys'
import { PasskeyIcon } from '@/shared/icons'
import { localStore } from '@/shared/platform/storage'
import { passkeysSupported } from '@/shared/platform/webauthn'
import { buttonVariants } from '@/shared/ui/button'

const KEY = 'mailcowui-ng.passkey-suggestion-dismissed'
const { t } = useI18n()
const titleId = useId()
const supported = passkeysSupported()
const dismissed = ref(localStore.get(KEY) === '1')
const enabled = computed(() => supported && !dismissed.value)
const query = useQuery({ ...passkeysListQuery({ limit: 1, offset: 0 }), enabled })
const show = computed(() => enabled.value && query.data.value?.meta.total === 0)

function dismiss() {
  dismissed.value = true
  localStore.set(KEY, '1')
}
</script>

<template>
  <section
    v-if="show"
    :aria-labelledby="titleId"
    class="surface flex flex-col gap-3 border-brand-200 bg-brand-25 sm:flex-row sm:items-center dark:border-brand-500/30 dark:bg-brand-500/10"
  >
    <PasskeyIcon class="size-8 shrink-0 text-brand-600 dark:text-brand-300" />
    <div class="min-w-0 flex-1">
      <h2 :id="titleId" class="font-semibold text-gray-900 dark:text-white">
        {{ t('home.passkeySuggestion.title') }}
      </h2>
      <p class="text-gray-700 dark:text-gray-300">{{ t('home.passkeySuggestion.body') }}</p>
    </div>
    <div class="flex flex-wrap gap-2">
      <RouterLink to="/passkeys" :class="buttonVariants({})">
        {{ t('home.passkeySuggestion.action') }}
      </RouterLink>
      <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="dismiss">
        {{ t('home.passkeySuggestion.dismiss') }}
      </button>
    </div>
  </section>
</template>
