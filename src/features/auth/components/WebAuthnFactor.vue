<script setup lang="ts">
// A security key or passkey as the second factor (FR-021): one action starts the device
// verification. A cancelled prompt keeps the step open without a message. A device without
// WebAuthn is told to choose another method.
import { useI18n } from 'vue-i18n'

import { passkeysSupported } from '@/shared/platform/webauthn'
import { buttonVariants } from '@/shared/ui/button'

import MethodSection from './MethodSection.vue'

defineProps<{ busy: boolean }>()
defineEmits<{ start: [] }>()
const { t } = useI18n()
const supported = passkeysSupported()
</script>

<template>
  <MethodSection type="webauthn">
    <button
      v-if="supported"
      type="button"
      :class="buttonVariants({ class: 'w-full sm:w-auto sm:self-start' })"
      :disabled="busy"
      :aria-busy="busy ? 'true' : 'false'"
      @click="$emit('start')"
    >
      {{ busy ? t('auth.secondFactor.webauthn.waiting') : t('auth.secondFactor.webauthn.start') }}
    </button>
    <p v-else class="text-sm text-gray-700 dark:text-gray-300">
      {{ t('auth.secondFactor.webauthn.unsupported') }}
    </p>
  </MethodSection>
</template>
