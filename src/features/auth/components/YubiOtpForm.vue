<script setup lang="ts">
// Yubico OTP (FR-023): one field for the key's output, checked to be 44 letters or digits before it
// is sent, and cleared after every attempt.
import { ref, useId, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SecondFactorVerification, Writable } from '@/api'
import FormField from '@/shared/components/FormField.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { buttonVariants } from '@/shared/ui/button'

import { isYubiOtp } from '../composables/useSecondFactor'
import MethodSection from './MethodSection.vue'

const props = defineProps<{ busy: boolean }>()
const emit = defineEmits<{ verify: [body: Writable<SecondFactorVerification>] }>()

const { t } = useI18n()
const fieldId = useId()
const otp = ref('')
const error = ref<string | null>(null)
const input = useTemplateRef<HTMLInputElement>('input')

function submit() {
  if (props.busy) return
  const value = otp.value.trim()
  if (!isYubiOtp(value)) {
    error.value = t('validation.format.yubicoOtp')
    announce(error.value, { assertive: true })
    input.value?.focus()
    return
  }
  error.value = null
  otp.value = ''
  emit('verify', { type: 'yubiOtp', otp: value })
}
</script>

<template>
  <MethodSection type="yubiOtp">
    <form novalidate class="flex flex-col gap-4" @submit.prevent="submit">
      <FormField
        :id="fieldId"
        v-slot="field"
        :label="t('auth.secondFactor.yubiOtp.field')"
        :description="t('auth.secondFactor.yubiOtp.help')"
        :errors="error ? [error] : []"
      >
        <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- labelled by FormField (for/id) -->
        <input
          ref="input"
          v-bind="field"
          v-model="otp"
          type="text"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          maxlength="64"
          class="form-control"
        />
      </FormField>
      <button
        type="submit"
        :class="buttonVariants({ class: 'w-full sm:w-auto sm:self-start' })"
        :disabled="busy"
        :aria-busy="busy ? 'true' : 'false'"
      >
        {{ t('auth.secondFactor.verify') }}
      </button>
    </form>
  </MethodSection>
</template>
