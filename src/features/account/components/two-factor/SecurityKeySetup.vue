<script setup lang="ts">
// Adding a security key (UI 005 US2, FR-049, research R11; legacy `#WebAuthnModal`): the name
// (`tfa.key_id`), the current password outside forced setup and "Start validation", then legacy's
// waiting text while the key is touched and "waiting for the server" afterwards. Without WebAuthn
// the browser is "not supported" (legacy's text) and the other methods stay usable.
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import type { OwnSecondFactor } from '@/api'
import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { passkeysSupported } from '@/shared/platform/webauthn'
import { buttonVariants } from '@/shared/ui/button'

import { useSecurityKeyEnrolment } from '../../composables/useSecurityKeyEnrolment'

const props = withDefaults(defineProps<{ requireCurrentPassword?: boolean }>(), {
  requireCurrentPassword: true,
})
const emit = defineEmits<{ done: [entry: OwnSecondFactor] }>()

const { t } = useI18n()
const id = useId()
const ids = { name: `${id}-name`, password: `${id}-password` }
const supported = passkeysSupported()
const enrolment = useSecurityKeyEnrolment()
const name = ref('')
const password = ref('')
const errors = ref<{ name?: string; password?: string }>({})
const busy = computed(() =>
  ['requesting', 'awaitingKey', 'verifying'].includes(enrolment.state.value),
)

async function start() {
  const next: typeof errors.value = {}
  const trimmed = name.value.trim()
  if (!trimmed) next.name = t('validation.required')
  if (props.requireCurrentPassword && !password.value) next.password = t('validation.required')
  errors.value = next
  const first = (['name', 'password'] as const).find((key) => next[key])
  if (first) {
    document.getElementById(ids[first])?.focus()
    announce(next[first]!, { assertive: true })
    return
  }
  const entry = await enrolment.start({
    name: trimmed,
    ...(props.requireCurrentPassword ? { currentPassword: password.value } : {}),
  })
  if (entry) {
    password.value = ''
    emit('done', entry)
    return
  }
  if (enrolment.problem.value?.is('current-password-incorrect')) {
    password.value = ''
    errors.value = { password: lt('danger.access_denied') }
    document.getElementById(ids.password)?.focus()
  }
}
</script>

<template>
  <div class="flex flex-col gap-4" data-security-key-setup>
    <p
      v-if="!supported"
      role="status"
      data-webauthn-unsupported
      class="text-gray-800 dark:text-gray-200"
    >
      {{ t('account.twoFactor.webauthn.unsupported') }}
    </p>
    <form v-else class="flex flex-col gap-4" novalidate @submit.prevent="start">
      <FormField
        :id="ids.name"
        :label="lt('tfa.key_id')"
        :errors="errors.name ? [errors.name] : []"
      >
        <template #default="control">
          <input
            v-bind="control"
            v-model="name"
            type="text"
            maxlength="255"
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
            v-model="password"
            type="password"
            autocomplete="current-password"
            maxlength="4096"
            class="form-control"
          />
        </template>
      </FormField>
      <div
        v-if="enrolment.state.value === 'awaitingKey'"
        role="status"
        class="text-gray-800 dark:text-gray-200"
      >
        <LegacyText k="tfa.waiting_usb_register" />
      </div>
      <p
        v-else-if="enrolment.state.value === 'verifying'"
        role="status"
        class="text-gray-800 dark:text-gray-200"
      >
        {{ t('account.twoFactor.webauthn.waitingServer') }}
      </p>
      <p
        v-if="enrolment.message.value"
        role="alert"
        data-webauthn-failure
        class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        {{ enrolment.message.value }}
      </p>
      <ProblemMessage
        v-else-if="enrolment.problem.value && !errors.password"
        :problem="enrolment.problem.value"
      />
      <button
        type="submit"
        :class="buttonVariants({ class: 'w-full sm:w-auto sm:self-start' })"
        :disabled="busy"
        :aria-busy="busy ? 'true' : 'false'"
      >
        {{
          enrolment.state.value === 'failed'
            ? t('common.retry')
            : lt('tfa.start_webauthn_validation')
        }}
      </button>
    </form>
  </div>
</template>
