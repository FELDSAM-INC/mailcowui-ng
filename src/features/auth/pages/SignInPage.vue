<script setup lang="ts">
// The sign-in screens (FR-001–FR-009, FR-016–FR-019, data-model §5): one role-neutral screen and
// one per role, which names the role in its heading and in every sign-in it sends. The operator's
// help text is sanitised and, as on the classic login page, behind "Show/Hide help panel". Texts
// with a classic counterpart are mailcow's own (`login.*`, `start.help`; plan "Legacy form map").
// UI 012 (FR-040 to FR-042, legacy form map): when single sign-on is offered, the role-neutral and
// mailbox-user screens show its button where the classic `user_index.twig` has it, after the
// password form and "Forgot password?" below the classic "or login with"; "force single sign-on"
// then hides the password form and the reset link (the passkey stays). Forcing it while it is not
// offered changes nothing. The administrator screens never offer it.
import { computed, defineAsyncComponent, onMounted, onScopeDispose, shallowRef, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ApiProblem, Role } from '@/api'
import { useBranding } from '@/app/branding/public-config'
import { legacy, type LegacyRef } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SanitizedHtml from '@/shared/components/SanitizedHtml.vue'
import { ChevronDownIcon } from '@/shared/icons'
import { sessionStore } from '@/shared/platform/storage'
import { passkeysSupported } from '@/shared/platform/webauthn'

import AppLinksSection from '../components/AppLinksSection.vue'
import ForgotPasswordLink from '../components/ForgotPasswordLink.vue'
import OrDivider from '../components/OrDivider.vue'
import PasskeySignInButton from '../components/PasskeySignInButton.vue'
import PasswordForm from '../components/PasswordForm.vue'
import RoleLinks from '../components/RoleLinks.vue'
import SignInNotice from '../components/SignInNotice.vue'
import { useConditionalPasskey } from '../composables/useConditionalPasskey'
import { usePasskeySignIn } from '../composables/usePasskeySignIn'

/** Loaded only when single sign-on is offered (constitution VII). */
const SingleSignOnSection = defineAsyncComponent(
  () => import('../components/SingleSignOnSection.vue'),
)

const props = defineProps<{ role?: Role | null }>()
const { t } = useI18n()
const { branding, query: publicConfig } = useBranding()
const titleId = useId()

const role = computed(() => props.role ?? null)
/** The card headings of the classic login pages; the role-neutral screen says "Login". */
const TITLES: Record<Role, LegacyRef> = {
  admin: legacy('login.login_admin'),
  domainAdmin: legacy('login.login_dadmin'),
  mailboxUser: legacy('login.login_user'),
}
const title = computed(() => (role.value ? TITLES[role.value] : legacy('login.login')))
const userScreen = computed(() => role.value === null || role.value === 'mailboxUser')
const ssoOffered = computed(
  () =>
    userScreen.value &&
    (publicConfig.data.value?.externalIdentityProvider.singleSignOnAvailable ?? false),
)
const forceSso = computed(() => ssoOffered.value && branding.value.loginPage.forceSingleSignOn)

// Passkeys first (FR-010–FR-012): one action, plus the browser's autofill on the username field.
const passkeys = passkeysSupported()
// The passkey action aborts the autofill request first and resumes it when it did not sign in.
const passkey = usePasskeySignIn({
  role: () => role.value,
  onStart: () => conditional.stop(),
  onSettled: () => conditional.start(),
})
const conditional = useConditionalPasskey({
  role: () => role.value,
  onError: (error) => passkey.report(error),
})

// UI 012: the last problem of a single sign-on start, kept when the action is gone (FR-043).
const ssoProblem = shallowRef<ApiProblem | null>(null)
// An address left behind by an abandoned round trip never steers a later return (research R4).
onMounted(() => sessionStore.remove('mailcowui-ng.sso-return-to'))

// A single sign-on start stops the autofill request before the page is left. When the start is
// refused, or the browser brings the page back from its back-forward cache on the way back from
// the provider, the screen is shown again and the request resumes (UI 001 fix).
let leftForSso = false
function ssoStarting() {
  leftForSso = true
  conditional.stop()
}
function resumeAfterSso() {
  if (!leftForSso) return
  leftForSso = false
  conditional.start()
}
function ssoProblemChanged(problem: ApiProblem | null) {
  ssoProblem.value = problem
  if (problem) resumeAfterSso()
}
const onPageShow = (event: PageTransitionEvent) => {
  if (event.persisted) resumeAfterSso()
}
window.addEventListener('pageshow', onPageShow)
onScopeDispose(() => window.removeEventListener('pageshow', onPageShow))
</script>

<template>
  <div class="flex flex-col gap-6">
    <section class="flex flex-col gap-5" :aria-labelledby="titleId">
      <LegacyText
        :id="titleId"
        :k="title.legacy"
        as="h1"
        tabindex="-1"
        class="text-2xl font-semibold text-gray-900 focus:outline-none dark:text-white"
      />
      <SignInNotice />
      <PasskeySignInButton
        v-if="passkeys"
        :pending="passkey.pending.value"
        :throttled="passkey.throttle.active.value"
        :countdown="passkey.throttle.clock.value"
        :problem="passkey.problem.value"
        :message-key="passkey.messageKey.value"
        :choose-again="conditional.chooseAgain.value"
        @start="passkey.signIn"
      />
      <template v-if="!forceSso">
        <OrDivider v-if="passkeys">{{ t('auth.passkey.or') }}</OrDivider>
        <PasswordForm
          :role="role"
          :webauthn-autofill="passkeys"
          :secondary="passkeys"
          @submitting="conditional.stop()"
          @failed="conditional.start()"
        />
        <!-- UI 005 (FR-034): the in-app reset, offered only when the server can send it. -->
        <ForgotPasswordLink v-if="userScreen" />
      </template>
      <SingleSignOnSection
        v-if="ssoOffered"
        :divider="!forceSso || passkeys"
        @starting="ssoStarting"
        @problem="ssoProblemChanged"
      />
      <ProblemMessage v-else :problem="ssoProblem" />
      <RoleLinks :role="role" />
    </section>
    <details v-if="branding.loginHelpHtml" data-help class="surface group">
      <summary
        class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg font-semibold text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-white [&::-webkit-details-marker]:hidden"
      >
        <LegacyText k="start.help" />
        <ChevronDownIcon
          class="size-5 shrink-0 group-open:rotate-180 motion-safe:transition-transform"
        />
      </summary>
      <div
        class="mt-2 text-sm wrap-anywhere text-gray-700 dark:text-gray-300 [&_a]:underline [&_a]:underline-offset-2"
      >
        <SanitizedHtml :html="branding.loginHelpHtml" />
      </div>
    </details>
    <AppLinksSection />
  </div>
</template>
