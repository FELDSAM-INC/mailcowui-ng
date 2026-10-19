<script setup lang="ts">
// Adding a Yubico OTP key (UI 005 US2, FR-050, research R11; legacy `#YubiOTPModal`): the name
// (`tfa.key_id`), legacy's explanation with its link (`tfa.api_register`, the product name from
// the branding), the Yubico API ID and key, the current password outside forced setup, and the OTP
// as the last field, so the key's final Enter submits the form. An unreachable Yubico service names
// itself with "Try again"; a refused key shows legacy's verification message.
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import type { OwnSecondFactor } from '@/api'
import { useBranding } from '@/app/branding/public-config'
import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { buttonVariants } from '@/shared/ui/button'

import { enrolSecondFactor } from '../../api/second-factors'

const props = withDefaults(defineProps<{ requireCurrentPassword?: boolean }>(), {
  requireCurrentPassword: true,
})
const emit = defineEmits<{ done: [entry: OwnSecondFactor] }>()

const { t } = useI18n()
const { branding } = useBranding()
const id = useId()
const ids = {
  name: `${id}-name`,
  clientId: `${id}-client`,
  secretKey: `${id}-secret`,
  password: `${id}-password`,
  otp: `${id}-otp`,
}
type Field = keyof typeof ids
const values = ref({ name: '', clientId: '', secretKey: '', password: '', otp: '' })
const errors = ref<Partial<Record<Field, string>>>({})
const failure = ref<string | null>(null)
const request = useSecretRequest(enrolSecondFactor)
const productName = computed(() => branding.value.productName)

function check(): Partial<Record<Field, string>> {
  const next: Partial<Record<Field, string>> = {}
  const v = values.value
  if (!v.name.trim()) next.name = t('validation.required')
  if (!/^[0-9]{1,32}$/.test(v.clientId.trim())) next.clientId = t('validation.format.digits')
  if (!v.secretKey) next.secretKey = t('validation.required')
  if (props.requireCurrentPassword && !v.password) next.password = t('validation.required')
  if (!/^[A-Za-z0-9]{44}$/.test(v.otp.trim())) next.otp = lt('danger.tfa_token_invalid')
  return next
}

async function submit() {
  failure.value = null
  const next = check()
  errors.value = next
  const first = (Object.keys(ids) as Field[]).find((key) => next[key])
  if (first) {
    document.getElementById(ids[first])?.focus()
    announce(next[first]!, { assertive: true })
    return
  }
  const v = values.value
  const entry = await request.run({
    type: 'yubiOtp',
    name: v.name.trim(),
    clientId: v.clientId.trim(),
    secretKey: v.secretKey,
    otp: v.otp.trim(),
    ...(props.requireCurrentPassword ? { currentPassword: v.password } : {}),
  })
  values.value.otp = ''
  if (entry) {
    values.value = { name: '', clientId: '', secretKey: '', password: '', otp: '' }
    emit('done', entry)
    return
  }
  const problem = request.problem.value
  if (problem?.is('current-password-incorrect')) {
    values.value.password = ''
    errors.value = { password: lt('danger.access_denied') }
    document.getElementById(ids.password)?.focus()
    return
  }
  if (problem?.is('temporary-verification-failure')) {
    failure.value = `${lt('danger.temp_error')}: ${t('selfService.dependency.yubico')}`
  } else if (problem?.is('second-factor-enrolment-failed')) {
    failure.value = lt('danger.yotp_verification_failed', 'unknown')
  } else if (problem) {
    failure.value = null
  }
  if (failure.value) announce(failure.value, { assertive: true })
}
</script>

<template>
  <form class="flex flex-col gap-4" novalidate data-yubico-setup @submit.prevent="submit">
    <FormField :id="ids.name" :label="lt('tfa.key_id')" :errors="errors.name ? [errors.name] : []">
      <template #default="control">
        <input
          v-bind="control"
          v-model="values.name"
          type="text"
          maxlength="255"
          autocomplete="off"
          class="form-control"
        />
      </template>
    </FormField>
    <LegacyText
      k="tfa.api_register"
      :args="[productName]"
      as="p"
      class="text-sm text-gray-700 dark:text-gray-300"
    />
    <FormField
      :id="ids.clientId"
      :label="t('account.twoFactor.yubico.clientId')"
      :errors="errors.clientId ? [errors.clientId] : []"
    >
      <template #default="control">
        <input
          v-bind="control"
          v-model="values.clientId"
          type="text"
          inputmode="numeric"
          maxlength="32"
          autocomplete="off"
          class="form-control"
        />
      </template>
    </FormField>
    <FormField
      :id="ids.secretKey"
      :label="t('account.twoFactor.yubico.secretKey')"
      :errors="errors.secretKey ? [errors.secretKey] : []"
    >
      <template #default="control">
        <input
          v-bind="control"
          v-model="values.secretKey"
          type="password"
          maxlength="128"
          autocomplete="off"
          class="form-control"
        />
      </template>
    </FormField>
    <FormField
      v-if="requireCurrentPassword"
      :id="ids.password"
      :label="lt('user.password_now')"
      :errors="errors.password ? [errors.password] : []"
    >
      <template #default="control">
        <input
          v-bind="control"
          v-model="values.password"
          type="password"
          autocomplete="current-password"
          maxlength="4096"
          class="form-control"
        />
      </template>
    </FormField>
    <FormField
      :id="ids.otp"
      :label="t('auth.secondFactor.yubiOtp.placeholder')"
      :errors="errors.otp ? [errors.otp] : []"
    >
      <template #default="control">
        <input
          v-bind="control"
          v-model="values.otp"
          type="password"
          maxlength="64"
          autocomplete="off"
          class="form-control"
        />
      </template>
    </FormField>
    <p
      v-if="failure"
      role="alert"
      data-yubico-failure
      class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
    >
      {{ failure }}
    </p>
    <button
      type="submit"
      :class="buttonVariants({ class: 'w-full sm:w-auto sm:self-start' })"
      :disabled="request.pending.value"
      :aria-busy="request.pending.value ? 'true' : 'false'"
    >
      {{ failure ? t('common.retry') : lt('user.save_changes') }}
    </button>
  </form>
</template>
