<script setup lang="ts">
// The password reset request (UI 005 US3, FR-035 to FR-037; legacy `reset-password.twig`, decision
// D18): legacy's "Reset Password" card with the address under `login.username` and "Request password
// change". Every accepted request gets the same confirmation with the link's lifetime, so the
// screen reveals nothing about accounts. An unavailable reset says so with legacy's message; too
// many requests show the countdown.
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { problemOf, type ApiProblem } from '@/api'
import { useSelfServiceCapabilities } from '@/shared/composables/useSelfServiceCapabilities'
import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useThrottle } from '@/shared/composables/useThrottle'
import { buttonVariants } from '@/shared/ui/button'

import { requestPasswordReset } from '../api'

const { t } = useI18n()
const fieldId = useId()
const capabilities = useSelfServiceCapabilities()
const address = ref('')
const error = ref<string | null>(null)
const pending = ref(false)
const problem = ref<ApiProblem | null>(null)
const minutes = ref<number | null>(null)
const throttle = useThrottle({ endedKey: 'account.password.throttleEnded' })

const unavailable = computed(
  () =>
    capabilities.data.value?.passwordReset.available === false ||
    problem.value?.is('password-reset-unavailable') === true,
)

async function submit() {
  if (pending.value || throttle.active.value) return
  const value = address.value.trim()
  if (!/^[^\s@]+@[^\s@]+$/.test(value)) {
    error.value = t('validation.format.email')
    announce(error.value, { assertive: true })
    document.getElementById(fieldId)?.focus()
    return
  }
  error.value = null
  problem.value = null
  pending.value = true
  try {
    const answer = await requestPasswordReset(value)
    minutes.value = answer.tokenLifetimeMinutes
    announce(t('auth.passwordReset.requested', { count: minutes.value }, minutes.value))
  } catch (failure) {
    const found = problemOf(failure)
    if (found?.is('too-many-requests')) throttle.start(found.retryAfter)
    else problem.value = found
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="flex flex-col gap-5" aria-labelledby="reset-request-title">
    <LegacyText
      id="reset-request-title"
      k="login.reset_password"
      as="h1"
      tabindex="-1"
      class="text-2xl font-semibold text-gray-900 focus:outline-none dark:text-white"
    />
    <LegacyText
      v-if="unavailable"
      k="danger.password_reset_na"
      as="p"
      role="alert"
      data-reset-unavailable
      class="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
    />
    <p
      v-else-if="minutes !== null"
      role="status"
      data-reset-requested
      class="rounded-xl border border-green-200 bg-green-50 p-4 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100"
    >
      {{ t('auth.passwordReset.requested', { count: minutes }, minutes) }}
    </p>
    <form v-else class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <FormField :id="fieldId" :label="lt('login.username')" :errors="error ? [error] : []">
        <template #default="control">
          <input
            v-bind="control"
            v-model="address"
            type="email"
            autocomplete="email"
            autocapitalize="none"
            spellcheck="false"
            maxlength="255"
            class="form-control"
          />
        </template>
      </FormField>
      <ProblemMessage :problem="problem" />
      <p
        v-if="throttle.active.value"
        role="status"
        class="text-sm text-gray-700 dark:text-gray-300"
      >
        <LegacyText k="danger.reset_token_limit_exceeded" />
        {{ t('auth.signIn.throttle.countdown', { time: throttle.clock.value }) }}
      </p>
      <button
        type="submit"
        :class="buttonVariants({ class: 'w-full' })"
        :disabled="pending || throttle.active.value"
        :aria-busy="pending ? 'true' : 'false'"
      >
        {{ lt('login.request_reset_password') }}
      </button>
    </form>
    <RouterLink :to="{ name: 'sign-in' }" class="text-link self-start">
      {{ lt('login.back_to_mailcow') }}
    </RouterLink>
  </section>
</template>
