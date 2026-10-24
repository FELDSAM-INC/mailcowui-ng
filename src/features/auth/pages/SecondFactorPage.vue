<script setup lang="ts">
// The second-factor step (FR-020–FR-029, data-model §7): its own screen with the methods in the
// server's order, the time limit with a warning one minute before it ends, "Cancel", and every
// outcome of the step. A reload resumes it from GET /session (FR-029). The title and "Cancel" are
// the classic two-factor modal's (`tfa.tfa`, `footer.cancel`).
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { WarningIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import OtherMethods from '../components/OtherMethods.vue'
import TotpForm from '../components/TotpForm.vue'
import WebAuthnFactor from '../components/WebAuthnFactor.vue'
import YubiOtpForm from '../components/YubiOtpForm.vue'
import { usePendingSignInTimer } from '../composables/usePendingSignInTimer'
import { useSecondFactor, type MethodSection } from '../composables/useSecondFactor'

const { t } = useI18n()
const titleId = useId()
const {
  pendingSignIn,
  groups,
  busy,
  problem,
  messageKey,
  verify,
  verifyWithWebAuthn,
  cancel,
  expire,
} = useSecondFactor()
const timer = usePendingSignInTimer(
  () => pendingSignIn.value?.expiresAt,
  () => void expire(),
)

const sections = computed(() => groups.value)
const hasTotp = computed(() =>
  sections.value.primarySections.some((section) => section.type === 'totp'),
)
/** The code field of a single authenticator takes focus (US1-AS4). */
const focusTotp = (section: MethodSection) => section.methods.length === 1
</script>

<template>
  <section class="flex flex-col gap-5" :aria-labelledby="titleId">
    <LegacyText
      :id="titleId"
      k="tfa.tfa"
      as="h1"
      tabindex="-1"
      class="text-2xl font-semibold text-gray-900 focus:outline-none dark:text-white"
    />
    <p class="text-sm text-gray-700 tabular-nums dark:text-gray-300">
      {{ t('auth.secondFactor.timeLeft', { time: timer.clock.value }) }}
    </p>
    <div
      v-if="timer.warned.value"
      class="flex gap-3 rounded-xl border border-warning-200 bg-warning-50 p-4 text-warning-900 dark:border-warning-900 dark:bg-warning-950 dark:text-warning-100"
    >
      <WarningIcon class="mt-0.5 size-5 shrink-0" />
      <p>{{ t('auth.secondFactor.oneMinute') }}</p>
    </div>
    <ProblemMessage :problem="problem" />
    <p
      v-if="messageKey"
      role="alert"
      class="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
    >
      {{ t(messageKey) }}
    </p>

    <template v-for="section in sections.primarySections" :key="section.type">
      <WebAuthnFactor
        v-if="section.type === 'webauthn'"
        :busy="busy !== null"
        @start="verifyWithWebAuthn"
      />
      <TotpForm
        v-else-if="section.type === 'totp'"
        :methods="section.methods"
        :busy="busy !== null"
        :take-focus="focusTotp(section)"
        auto-submit
        @verify="verify"
      >
        <template #cancel>
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline' })"
            :disabled="busy === 'cancel'"
            @click="cancel"
          >
            <LegacyText k="footer.cancel" />
          </button>
        </template>
      </TotpForm>
    </template>

    <template v-if="sections.advancedSections.length > 0">
      <template v-if="sections.advancedDirect">
        <YubiOtpForm :busy="busy !== null" @verify="verify" />
      </template>
      <OtherMethods v-else>
        <YubiOtpForm :busy="busy !== null" @verify="verify" />
      </OtherMethods>
    </template>

    <button
      v-if="!hasTotp"
      type="button"
      :class="buttonVariants({ variant: 'outline', class: 'w-full sm:w-auto sm:self-start' })"
      :disabled="busy === 'cancel'"
      @click="cancel"
    >
      <LegacyText k="footer.cancel" />
    </button>
  </section>
</template>
