<script setup lang="ts">
// One second-factor method of the step: a labelled region with its heading (FR-020), the
// classic interface's name of the method (`tfa.webauthn`, `tfa.totp`, `tfa.yubi_otp`).
import { useId } from 'vue'

import type { SecondFactorType } from '@/api'
import type { LegacyKey } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'

defineProps<{ type: SecondFactorType }>()
const titleId = useId()

const TITLES: Record<SecondFactorType, LegacyKey> = {
  webauthn: 'tfa.webauthn',
  totp: 'tfa.totp',
  yubiOtp: 'tfa.yubi_otp',
}
</script>

<template>
  <section
    :data-method="type"
    :aria-labelledby="titleId"
    class="flex flex-col gap-3 border-t border-gray-200 pt-4 dark:border-gray-800"
  >
    <LegacyText
      :id="titleId"
      :k="TITLES[type]"
      as="h2"
      class="font-semibold text-gray-900 dark:text-white"
    />
    <slot />
  </section>
</template>
