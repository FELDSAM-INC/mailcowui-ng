<script setup lang="ts">
// The sign-in screens (FR-001–FR-009, FR-016–FR-019, data-model §5): one role-neutral screen and
// one per role, which names the role in its heading and in every sign-in it sends. Force single
// sign-on hides the password form on the role-neutral and mailbox-user screens; an identity
// provider adds a hint up front. The operator's help text is sanitised and, as on the classic
// login page, behind "Show/Hide help panel". Texts with a classic counterpart are mailcow's own
// (`login.*`, `start.help`; plan "Legacy form map").
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Role } from '@/api'
import { useBranding } from '@/app/branding/public-config'
import { CLASSIC_PASSWORD_RESET } from '@/app/navigation/classic-links'
import { legacy, type LegacyRef } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'
import SanitizedHtml from '@/shared/components/SanitizedHtml.vue'
import { ChevronDownIcon } from '@/shared/icons'
import { passkeysSupported } from '@/shared/platform/webauthn'

import AppLinksSection from '../components/AppLinksSection.vue'
import IdpHint from '../components/IdpHint.vue'
import PasskeySignInButton from '../components/PasskeySignInButton.vue'
import PasswordForm from '../components/PasswordForm.vue'
import RoleLinks from '../components/RoleLinks.vue'
import SignInHeader from '../components/SignInHeader.vue'
import SignInNotice from '../components/SignInNotice.vue'
import SsoNotice from '../components/SsoNotice.vue'
import { useConditionalPasskey } from '../composables/useConditionalPasskey'
import { usePasskeySignIn } from '../composables/usePasskeySignIn'

const props = defineProps<{ role?: Role | null }>()
const { t } = useI18n()
const { branding } = useBranding()
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
const forceSso = computed(() => branding.value.loginPage.forceSingleSignOn && userScreen.value)

// Passkeys first (FR-010–FR-012): one action, plus the browser's autofill on the username field.
const passkeys = passkeysSupported()
const passkey = usePasskeySignIn({ role: () => role.value, onSettled: () => conditional.start() })
const conditional = useConditionalPasskey({
  role: () => role.value,
  onError: (error) => passkey.report(error),
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <SignInHeader />
    <section class="surface flex flex-col gap-5" :aria-labelledby="titleId">
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
      <SsoNotice v-if="forceSso" />
      <template v-else>
        <p
          v-if="passkeys"
          class="flex items-center gap-3 text-sm text-gray-700 before:h-px before:flex-1 before:bg-gray-200 after:h-px after:flex-1 after:bg-gray-200 dark:text-gray-300 dark:before:bg-gray-700 dark:after:bg-gray-700"
        >
          {{ t('auth.passkey.or') }}
        </p>
        <IdpHint v-if="branding.externalIdentityProvider" :role="role" />
        <PasswordForm
          :role="role"
          :webauthn-autofill="passkeys"
          :secondary="passkeys"
          @submitting="conditional.stop()"
          @failed="conditional.start()"
        />
        <LegacyText
          v-if="userScreen"
          k="login.forgot_password"
          as="a"
          :href="CLASSIC_PASSWORD_RESET"
          class="text-link self-start"
        />
      </template>
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
