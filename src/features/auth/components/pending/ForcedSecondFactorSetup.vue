<script setup lang="ts">
// The forced second-factor setup on the pending-actions screen (UI 005 US2, FR-057 to FR-059,
// research R8; legacy `#SetupTFAModal`, decision D10): the passkey first (the owner's choice,
// UI 001's registration), then legacy's tabs in legacy's order: TOTP, WebAuthn and Yubico OTP,
// each opened in place without the current password. Without passkey support the other methods
// replace UI 001's link to the classic interface. Any enrolment lifts the restriction; the parent
// then reads the session again and continues.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { SecurityKeySetup, TotpSetup, YubicoOtpSetup } from '@/features/account'
import { lt, type LegacyKey } from '@/i18n'
import { buttonVariants } from '@/shared/ui/button'

defineProps<{ passkeys: boolean; busy: boolean }>()
const emit = defineEmits<{ register: []; done: [] }>()
const { t } = useI18n()

type Method = 'totp' | 'webauthn' | 'yubiOtp'
const METHODS: { id: Method; label: LegacyKey }[] = [
  { id: 'totp', label: 'tfa.totp' },
  { id: 'webauthn', label: 'tfa.webauthn' },
  { id: 'yubiOtp', label: 'tfa.yubi_otp' },
]
const open = ref<Method | null>(null)
</script>

<template>
  <div class="flex flex-col gap-4" data-forced-second-factor>
    <div v-if="passkeys" class="flex flex-col gap-2">
      <p class="text-gray-700 dark:text-gray-300">
        {{ t('auth.pendingActions.secondFactor.required') }}
      </p>
      <button
        type="button"
        :class="buttonVariants({ class: 'w-full sm:w-auto sm:self-start' })"
        :disabled="busy"
        :aria-busy="busy ? 'true' : 'false'"
        @click="emit('register')"
      >
        {{ t('auth.pendingActions.secondFactor.register') }}
      </button>
    </div>
    <div class="flex flex-col gap-2">
      <div v-for="method in METHODS" :key="method.id" class="flex flex-col gap-3">
        <button
          type="button"
          :data-method="method.id"
          :aria-expanded="open === method.id ? 'true' : 'false'"
          :class="
            buttonVariants({
              variant: 'outline',
              class: 'h-auto min-h-11 justify-start py-2 text-start whitespace-normal',
            })
          "
          @click="open = open === method.id ? null : method.id"
        >
          {{ lt(method.label) }}
        </button>
        <div v-if="open === method.id" class="ps-1">
          <TotpSetup
            v-if="method.id === 'totp'"
            :require-current-password="false"
            @done="emit('done')"
          />
          <SecurityKeySetup
            v-else-if="method.id === 'webauthn'"
            :require-current-password="false"
            @done="emit('done')"
          />
          <YubicoOtpSetup v-else :require-current-password="false" @done="emit('done')" />
        </div>
      </div>
    </div>
  </div>
</template>
