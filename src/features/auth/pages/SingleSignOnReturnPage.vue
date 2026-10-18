<script setup lang="ts">
// The return from the organisation's sign-in page, `/ng/sso/return` (UI 012 FR-045 to FR-049,
// research R5, R6). The code and state were captured and removed from the address before the app
// started; this page shows the operator's branding and an announced progress state while the
// sign-in completes, then lands on the requested page. Every other outcome is shown as a focused,
// announced message with "Try again" (a new single sign-on) and "Back to sign-in". Its heading is
// the classic button text `admin.iam_sso`; the outcomes use the API's problem messages, with the
// classic `danger.login_failed` for a refused sign-in.
import { nextTick, useId, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useProblemMessages } from '@/i18n/problems'
import { buttonVariants } from '@/shared/ui/button'

import SignInHeader from '../components/SignInHeader.vue'
import { useSingleSignOnReturn } from '../composables/useSingleSignOnReturn'

const { t } = useI18n()
const { problemMessage } = useProblemMessages()
const titleId = useId()
const outcomeRef = useTemplateRef<HTMLElement>('outcomeRef')
const { working, outcome, retry, retrying, retryProblem, backTo } = useSingleSignOnReturn()

announce(t('auth.sso.completing'))

watch(outcome, async (value) => {
  if (!value) return
  await nextTick()
  outcomeRef.value?.focus()
  announce(
    value.kind === 'cancelled' ? t('auth.sso.outcome.cancelled') : problemMessage(value.problem),
    { assertive: true },
  )
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <SignInHeader />
    <section class="surface flex flex-col gap-5" :aria-labelledby="titleId">
      <LegacyText
        :id="titleId"
        k="admin.iam_sso"
        as="h1"
        tabindex="-1"
        class="text-2xl font-semibold text-gray-900 focus:outline-none dark:text-white"
      />
      <p
        v-if="working"
        role="status"
        aria-busy="true"
        class="flex items-center gap-3 text-gray-700 dark:text-gray-300"
      >
        <span
          aria-hidden="true"
          class="size-5 shrink-0 rounded-full border-2 border-gray-300 border-t-brand-500 motion-safe:animate-spin dark:border-gray-700 dark:border-t-brand-400"
        />
        {{ t('auth.sso.completing') }}
      </p>
      <template v-else-if="outcome">
        <div
          ref="outcomeRef"
          data-outcome
          tabindex="-1"
          class="rounded-xl focus:outline-2 focus:outline-offset-2 focus:outline-brand-500"
        >
          <p
            v-if="outcome.kind === 'cancelled'"
            role="alert"
            class="rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            {{ t('auth.sso.outcome.cancelled') }}
          </p>
          <ProblemMessage v-else :problem="outcome.problem" />
        </div>
        <ProblemMessage :problem="retryProblem" />
        <div class="flex flex-col gap-3">
          <button
            v-if="outcome.kind === 'cancelled' || outcome.canRetry"
            type="button"
            data-retry
            :class="buttonVariants({ class: 'w-full' })"
            :disabled="retrying"
            :aria-busy="retrying ? 'true' : 'false'"
            @click="retry"
          >
            {{ t('common.retry') }}
          </button>
          <RouterLink
            data-back
            :to="backTo"
            :class="buttonVariants({ variant: 'outline', class: 'w-full' })"
          >
            {{ t('auth.sso.backToSignIn') }}
          </RouterLink>
        </div>
      </template>
    </section>
  </div>
</template>
