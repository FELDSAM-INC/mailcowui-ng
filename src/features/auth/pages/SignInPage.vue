<script setup lang="ts">
// The sign-in screens (FR-001–FR-009, FR-016–FR-019, data-model §5): one role-neutral screen and
// one per role, which names the role in its heading and in every sign-in it sends. Force single
// sign-on hides the password form on the role-neutral and mailbox-user screens; an identity
// provider adds a hint up front. The operator's help text is sanitised.
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Role } from '@/api'
import { useBranding } from '@/app/branding/public-config'
import { CLASSIC_PASSWORD_RESET } from '@/app/navigation/classic-links'
import SanitizedHtml from '@/shared/components/SanitizedHtml.vue'
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
const helpId = useId()

const role = computed(() => props.role ?? null)
const TITLES: Record<Role, string> = {
  admin: 'auth.signIn.titleAdmin',
  domainAdmin: 'auth.signIn.titleDomainAdmin',
  mailboxUser: 'auth.signIn.titleMailboxUser',
}
const title = computed(() => t(role.value ? TITLES[role.value] : 'auth.signIn.title'))
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
      <h1
        :id="titleId"
        tabindex="-1"
        class="text-2xl font-semibold text-gray-900 focus:outline-none dark:text-white"
      >
        {{ title }}
      </h1>
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
        <a v-if="userScreen" :href="CLASSIC_PASSWORD_RESET" class="text-link self-start">
          {{ t('auth.signIn.forgotPassword') }}
        </a>
      </template>
      <RoleLinks :role="role" />
    </section>
    <section v-if="branding.loginHelpHtml" data-help class="surface" :aria-labelledby="helpId">
      <h2 :id="helpId" class="font-semibold text-gray-900 dark:text-white">
        {{ t('auth.signIn.help') }}
      </h2>
      <div
        class="mt-2 text-sm wrap-anywhere text-gray-700 dark:text-gray-300 [&_a]:underline [&_a]:underline-offset-2"
      >
        <SanitizedHtml :html="branding.loginHelpHtml" />
      </div>
    </section>
    <AppLinksSection />
  </div>
</template>
