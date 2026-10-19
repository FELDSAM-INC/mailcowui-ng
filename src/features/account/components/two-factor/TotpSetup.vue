<script setup lang="ts">
// Adding an authenticator app (UI 005 US2, FR-045 to FR-048, research R10; legacy `#TOTPModal`):
// one form as legacy has it: the name (`tfa.key_id_totp`), the current password outside forced
// setup, then 1. scan or enter the key (the key in groups with a copy button and "Open in
// authenticator app" come before the QR code, so phones reach them first), 2. confirm with the
// generated code, and "Confirm". The enrolment starts when the form opens, lives in component state
// only and is discarded on success, on leave and on expiry. A wrong code keeps the same key with
// the attempts left and the clock hint; an expired setup offers to start again.
import { computed, onMounted, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { OwnSecondFactor } from '@/api'
import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import GroupedSecret from '@/shared/components/GroupedSecret.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { buttonVariants } from '@/shared/ui/button'

import { useTotpEnrolment } from '../../composables/useTotpEnrolment'
import { isOtpauthUri } from '../../totp'
import QrCode from './QrCode.vue'

const props = withDefaults(defineProps<{ requireCurrentPassword?: boolean }>(), {
  requireCurrentPassword: true,
})
const emit = defineEmits<{ done: [entry: OwnSecondFactor] }>()

const { t } = useI18n()
const id = useId()
const ids = { name: `${id}-name`, password: `${id}-password`, code: `${id}-code` }
const totp = useTotpEnrolment()
const name = ref('')
const password = ref('')
const code = ref('')
const errors = ref<{ name?: string; password?: string; code?: string }>({})

onMounted(() => void totp.start())
useLeaveGuard(
  () => totp.state.value === 'shown' || totp.state.value === 'confirming',
  'leaveGuard.body',
)

const enrolment = computed(() => totp.enrolment.value)
const openUri = computed(() =>
  isOtpauthUri(enrolment.value?.provisioningUri) ? enrolment.value.provisioningUri : null,
)

watch(
  () => totp.problem.value,
  (problem) => {
    if (!problem) return
    if (problem.is('current-password-incorrect')) {
      password.value = ''
      errors.value = { password: lt('danger.access_denied') }
      document.getElementById(ids.password)?.focus()
    } else if (problem.is('second-factor-enrolment-failed')) {
      const left = problem.attemptsRemaining ?? 0
      errors.value = {
        code: [
          lt('danger.totp_verification_failed'),
          t('account.twoFactor.totp.attemptsLeft', { count: left }, left),
          t('account.twoFactor.totp.clockHint'),
        ].join(' '),
      }
      document.getElementById(ids.code)?.focus()
    }
    if (errors.value.code) announce(errors.value.code, { assertive: true })
    else if (errors.value.password) announce(errors.value.password, { assertive: true })
  },
)

async function submit() {
  const next: typeof errors.value = {}
  const trimmed = name.value.trim()
  const digits = code.value.replace(/\s/g, '')
  if (!trimmed) next.name = t('validation.required')
  if (props.requireCurrentPassword && !password.value) next.password = t('validation.required')
  if (!/^[0-9]{6}$/.test(digits)) next.code = t('validation.format.totpCode')
  errors.value = next
  const first = (['name', 'password', 'code'] as const).find((key) => next[key])
  if (first) {
    document.getElementById(ids[first])?.focus()
    announce(next[first]!, { assertive: true })
    return
  }
  const entry = await totp.confirm({
    name: trimmed,
    code: digits,
    ...(props.requireCurrentPassword ? { currentPassword: password.value } : {}),
  })
  code.value = ''
  if (entry) {
    password.value = ''
    emit('done', entry)
  }
}

async function restart() {
  code.value = ''
  errors.value = {}
  await totp.start()
}
</script>

<template>
  <div class="flex flex-col gap-4" data-totp-setup>
    <div
      v-if="totp.state.value === 'starting'"
      role="status"
      aria-busy="true"
      class="text-gray-600 dark:text-gray-400"
    >
      {{ lt('footer.loading') }}
    </div>
    <div v-else-if="totp.state.value === 'expired'" class="flex flex-col gap-3" data-totp-expired>
      <p role="alert" class="font-medium text-gray-900 dark:text-white">
        {{ t('problem.second-factor-enrolment-expired') }}
      </p>
      <button type="button" :class="buttonVariants({ class: 'self-start' })" @click="restart">
        {{ t('account.twoFactor.enrolment.restart') }}
      </button>
    </div>
    <ProblemMessage
      v-else-if="totp.state.value === 'failed'"
      :problem="totp.problem.value"
      retry
      @retry="restart"
    />
    <form v-else class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <FormField
        :id="ids.name"
        :label="lt('tfa.key_id_totp')"
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
      <ol class="flex list-decimal flex-col gap-4 ps-5">
        <li class="flex flex-col gap-3">
          <LegacyText k="tfa.scan_qr_code" as="p" />
          <div v-if="enrolment" class="flex flex-col gap-4 md:flex-row md:items-start">
            <div class="flex min-w-0 flex-col gap-2">
              <LegacyText
                k="tfa.enter_qr_code"
                as="p"
                class="text-sm text-gray-700 dark:text-gray-300"
              />
              <GroupedSecret
                :value="enrolment.secret"
                :copy-label="t('account.twoFactor.totp.copyKey')"
              />
              <a
                v-if="openUri"
                :href="openUri"
                data-open-in-app
                :class="buttonVariants({ variant: 'outline', class: 'self-start' })"
              >
                {{ t('account.twoFactor.totp.openInApp') }}
              </a>
            </div>
            <QrCode :data-uri="enrolment.qrCode" />
          </div>
        </li>
        <li class="flex flex-col gap-3">
          <LegacyText k="tfa.confirm_totp_token" as="p" />
          <FormField
            :id="ids.code"
            :label="t('auth.secondFactor.totp.code')"
            :errors="errors.code ? [errors.code] : []"
          >
            <template #default="control">
              <input
                v-bind="control"
                v-model="code"
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="16"
                class="form-control tabular-nums"
              />
            </template>
          </FormField>
        </li>
      </ol>
      <ProblemMessage
        v-if="totp.problem.value && !errors.code && !errors.password"
        :problem="totp.problem.value"
      />
      <button
        type="submit"
        :class="buttonVariants({ class: 'w-full sm:w-auto sm:self-start' })"
        :disabled="totp.pending.value"
        :aria-busy="totp.pending.value ? 'true' : 'false'"
      >
        {{ lt('tfa.confirm') }}
      </button>
    </form>
  </div>
</template>
