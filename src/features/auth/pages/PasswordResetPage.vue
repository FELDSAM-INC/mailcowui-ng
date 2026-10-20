<script setup lang="ts">
// The reset page that the e-mailed link opens (UI 005 US3, FR-038 to FR-042, research R12; legacy
// `reset-password.twig`, decisions D8, D17): the token already left the address bar (the route's
// `beforeEnter`). A valid link asks, when a session is open, whether to go on, because the reset
// signs out every session of the account, this one too; then the new password twice with the
// policy; then, for an account with second factors, the factor step of sign-in. Invalid and expired
// links offer a new one; an account with only deprecated factors is told to ask an administrator.
// The reset never signs in: it offers the sign-in screen.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import LegacyText from '@/shared/components/LegacyText.vue'
import NewPasswordFields from '@/shared/components/password/NewPasswordFields.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { rulesOfViolation, type PolicyRuleId } from '@/shared/password/policy-rules'
import { buttonVariants } from '@/shared/ui/button'

import OtherMethods from '../components/OtherMethods.vue'
import TotpForm from '../components/TotpForm.vue'
import WebAuthnFactor from '../components/WebAuthnFactor.vue'
import YubiOtpForm from '../components/YubiOtpForm.vue'
import { usePasswordReset } from '../composables/usePasswordReset'
import { groupMethods } from '../composables/useSecondFactor'

const { t } = useI18n()
const format = useFormat()
const reset = usePasswordReset()
const password = ref('')
const password2 = ref('')
const fields = ref<{ validate(): boolean; reset(): void } | null>(null)
const validLink = computed(() =>
  ['warning', 'password', 'completing', 'factor'].includes(reset.state.value),
)

watch(reset.state, (state) => {
  if (['invalid', 'unavailable', 'askAdministrator', 'done'].includes(state)) {
    password.value = ''
    password2.value = ''
    fields.value?.reset()
  }
})

onMounted(() => void reset.start())

const policy = computed(() => {
  const value = reset.info.value?.passwordPolicy
  if (!value) return null
  const { etag: _etag, ...rules } = value
  return rules
})
const passwordErrors = computed(() => {
  const violations = reset.problem.value?.fieldErrors.get('newPassword') ?? []
  return violations.length > 0 ? [lt('danger.password_complexity')] : []
})
const failedRules = computed<PolicyRuleId[]>(() =>
  (reset.problem.value?.fieldErrors.get('newPassword') ?? []).flatMap(rulesOfViolation),
)
const preHashed = computed(() =>
  (reset.problem.value?.fieldErrors.get('newPassword') ?? []).find(
    (violation) => violation.code === 'preHashedPassword',
  ),
)
const groups = computed(() => groupMethods(reset.methods.value))
const self = computed(
  () =>
    reset.signedInAs.value !== null &&
    reset.signedInAs.value.toLowerCase() === reset.info.value?.address.toLowerCase(),
)
const factorMessage = computed(() => {
  const failure = reset.problem.value
  if (!failure) return null
  if (failure.is('second-factor-failed')) {
    if (reset.submittedMethod.value === 'yubiOtp') return lt('danger.yotp_verification_failed')
    if (reset.submittedMethod.value === 'webauthn') return lt('danger.webauthn_verification_failed')
    return lt('danger.totp_verification_failed')
  }
  if (failure.is('temporary-verification-failure')) {
    return `${lt('danger.temp_error')}: ${t('selfService.dependency.yubico')}`
  }
  return null
})

async function submitPassword() {
  if (!password.value) return
  if (!(fields.value?.validate() ?? password.value === password2.value)) {
    announce(lt('danger.password_mismatch'), { assertive: true })
    return
  }
  await reset.submitPassword(password.value)
  if (reset.state.value !== 'password') {
    password.value = ''
    password2.value = ''
    fields.value?.reset()
  } else if (passwordErrors.value.length > 0) {
    announce(passwordErrors.value[0]!, { assertive: true })
  }
}
</script>

<template>
  <section class="surface flex flex-col gap-5" aria-labelledby="reset-title">
    <LegacyText
      id="reset-title"
      k="login.reset_password"
      as="h1"
      tabindex="-1"
      class="text-2xl font-semibold text-gray-900 focus:outline-none dark:text-white"
    />
    <dl
      v-if="validLink && reset.info.value"
      class="flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-300"
    >
      <div data-reset-account>
        <dt class="font-medium">{{ lt('login.username') }}</dt>
        <dd class="break-words [overflow-wrap:anywhere]">{{ reset.info.value.address }}</dd>
      </div>
      <div data-reset-expiry>
        <dt class="font-medium">{{ lt('user.expire_in') }}</dt>
        <dd>{{ format.duration(reset.remaining.value) }}</dd>
        <dd>
          <time :datetime="reset.info.value.expiresAt">
            {{ format.dateTime(reset.info.value.expiresAt) }}
          </time>
        </dd>
      </div>
    </dl>
    <div v-if="reset.state.value === 'checking'" role="status" aria-busy="true">
      {{ lt('footer.loading') }}
    </div>
    <ProblemMessage
      v-else-if="reset.state.value === 'error'"
      :problem="reset.problem.value"
      :retry="!reset.throttled.value"
      @retry="reset.retry()"
    />
    <template v-else-if="reset.state.value === 'invalid'">
      <LegacyText
        k="login.invalid_pass_reset_token"
        as="p"
        role="alert"
        data-reset-invalid
        class="text-gray-800 dark:text-gray-200"
      />
      <RouterLink
        :to="{ name: 'password-reset-request' }"
        :class="buttonVariants({ class: 'self-start' })"
      >
        {{ lt('login.request_reset_password') }}
      </RouterLink>
    </template>
    <LegacyText
      v-else-if="reset.state.value === 'unavailable'"
      k="danger.password_reset_na"
      as="p"
      role="alert"
      class="text-gray-800 dark:text-gray-200"
    />
    <p
      v-else-if="reset.state.value === 'askAdministrator'"
      role="alert"
      data-reset-ask-administrator
      class="text-gray-800 dark:text-gray-200"
    >
      {{ t('problem.second-factor-unavailable') }}
    </p>
    <div
      v-else-if="reset.state.value === 'warning'"
      class="flex flex-col gap-3"
      data-reset-signed-in
    >
      <p
        class="rounded-xl border border-warning-200 bg-warning-50 p-4 text-warning-900 dark:border-warning-900 dark:bg-warning-950 dark:text-warning-100"
      >
        {{
          self ? t('auth.passwordReset.signedIn.bodySelf') : t('auth.passwordReset.signedIn.body')
        }}
      </p>
      <div class="flex flex-col gap-2 sm:flex-row">
        <button type="button" :class="buttonVariants({})" @click="reset.proceed()">
          {{ t('auth.passwordReset.signedIn.continue') }}
        </button>
        <RouterLink :to="{ name: 'home' }" :class="buttonVariants({ variant: 'outline' })">
          {{ t('auth.passwordReset.signedIn.back') }}
        </RouterLink>
      </div>
    </div>
    <form
      v-else-if="
        reset.state.value === 'password' ||
        (reset.state.value === 'completing' && reset.methods.value.length === 0)
      "
      class="flex flex-col gap-4"
      novalidate
      data-reset-password
      @submit.prevent="submitPassword"
    >
      <NewPasswordFields
        ref="fields"
        v-model:password="password"
        v-model:password2="password2"
        id-prefix="reset"
        :policy="policy"
        :username="reset.info.value?.address ?? null"
        label-key="login.new_password"
        repeat-key="login.new_password_confirm"
        generate-key="user.generate"
        :errors="
          preHashed
            ? [
                t('validation.preHashedPassword', {
                  scheme: String(preHashed.params?.scheme ?? ''),
                }),
              ]
            : passwordErrors
        "
        :failed-rules="failedRules"
      />
      <ProblemMessage
        v-if="reset.problem.value && !reset.problem.value.is('validation-failed')"
        :problem="reset.problem.value"
      />
      <button
        type="submit"
        :class="buttonVariants({ class: 'w-full' })"
        :disabled="reset.busy.value"
        :aria-busy="reset.busy.value ? 'true' : 'false'"
      >
        {{ lt('login.reset_password') }}
      </button>
    </form>
    <div
      v-else-if="reset.state.value === 'factor' || reset.state.value === 'completing'"
      class="flex flex-col gap-4"
      data-reset-factor
    >
      <LegacyText k="tfa.tfa" as="h2" class="font-semibold text-gray-900 dark:text-white" />
      <LegacyText
        k="info.awaiting_tfa_confirmation"
        as="p"
        class="text-gray-700 dark:text-gray-300"
      />
      <p
        v-if="factorMessage"
        role="alert"
        class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        {{ factorMessage }}
      </p>
      <ProblemMessage v-else :problem="reset.problem.value" />
      <template v-for="section in groups.primarySections" :key="section.type">
        <WebAuthnFactor
          v-if="section.type === 'webauthn'"
          :busy="reset.busy.value"
          @start="reset.submitWebAuthn()"
        />
        <TotpForm
          v-else-if="section.type === 'totp'"
          :methods="section.methods"
          :busy="reset.busy.value"
          :take-focus="section.methods.length === 1"
          @verify="reset.submitFactor($event)"
        />
      </template>
      <template v-if="groups.advancedSections.length > 0">
        <YubiOtpForm
          v-if="groups.advancedDirect"
          :busy="reset.busy.value"
          @verify="reset.submitFactor($event)"
        />
        <OtherMethods v-else>
          <YubiOtpForm :busy="reset.busy.value" @verify="reset.submitFactor($event)" />
        </OtherMethods>
      </template>
    </div>
    <div v-else-if="reset.state.value === 'done'" class="flex flex-col gap-3" data-reset-done>
      <p
        role="status"
        class="rounded-xl border border-green-200 bg-green-50 p-4 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100"
      >
        {{ lt('success.password_changed_success') }}
        {{ t('auth.passwordReset.done.sessionsEnded') }}
      </p>
      <RouterLink :to="{ name: 'sign-in' }" :class="buttonVariants({ class: 'self-start' })">
        {{ lt('login.login') }}
      </RouterLink>
    </div>
    <p v-if="reset.throttled.value" role="status" class="text-sm text-gray-700 dark:text-gray-300">
      {{ t('auth.signIn.throttle.countdown', { time: reset.retryClock.value }) }}
    </p>
    <RouterLink
      v-if="reset.state.value !== 'done'"
      :to="{ name: 'sign-in' }"
      class="text-link self-start"
    >
      {{ lt('login.back_to_mailcow') }}
    </RouterLink>
  </section>
</template>
