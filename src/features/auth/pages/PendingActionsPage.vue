<script setup lang="ts">
// The pending-actions screen of a restricted session (FR-038–FR-041): the actions in plain
// language, the password change first, their resolutions and "Sign out". Every other address shows
// this screen (the guard). After a passkey registration or a successful "Check again" the app
// continues as after sign-in (FR-031), without a new sign-in. Language and theme are chosen in the
// layout and apply on this device only, because the server does not save preferences here. "Sign
// out" is the classic forced-setup modal's "Cancel and log out" (`tfa.cancel_setup`).
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ApiProblem, PendingAction } from '@/api'
import { sessionContext } from '@/app/session/context'
import { continueAfterSignIn } from '@/app/session/landing'
import { cachedSession, fetchSession, identityQuery, useSessionQuery } from '@/app/session/queries'
import { rerouteCurrent } from '@/app/session/reroute'
import { useSignOut } from '@/app/session/sign-out'
import { usePasskeyRegistration } from '@/features/passkeys'
import { queryKeys } from '@/api'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { passkeysSupported } from '@/shared/platform/webauthn'
import { buttonVariants } from '@/shared/ui/button'

import { acceptSession } from '../api'
import PendingActionItem from '../components/PendingActionItem.vue'

const ORDER: Record<PendingAction, number> = { passwordChange: 0, secondFactorSetup: 1 }

const { t } = useI18n()
const sessionQuery = useSessionQuery()
const session = computed(() => sessionQuery.data.value)
const actions = computed(() =>
  [...(session.value?.pendingActions ?? [])].sort((a, b) => ORDER[a] - ORDER[b]),
)
const role = computed(() => session.value?.role ?? null)
const supported = passkeysSupported()
const soleSetup = computed(
  () => actions.value.length === 1 && actions.value[0] === 'secondFactorSetup',
)
const checking = ref(false)
const stillPending = ref(false)
const problem = shallowRef<ApiProblem | null>(null)
const registration = usePasskeyRegistration()
const { signOut, pending: signingOut, failed: signOutFailed } = useSignOut()

async function checkAgain() {
  if (checking.value) return
  checking.value = true
  stillPending.value = false
  problem.value = null
  try {
    const ctx = sessionContext()
    const next = await fetchSession()
    if (next.state === 'restricted') {
      ctx.queryClient.setQueryData(queryKeys.session(), next)
      await ctx.queryClient.fetchQuery({ ...identityQuery(), staleTime: 0 })
      stillPending.value = true
      announce(t('auth.pendingActions.password.stillPending'))
    } else {
      await acceptSession(next)
    }
  } catch (error) {
    problem.value = error as ApiProblem
  } finally {
    checking.value = false
  }
}

async function register() {
  const passkey = await registration.register()
  // The registration read the session and the identity again; the guard continues once the
  // restriction has lifted.
  if (!passkey) return
  // UI 005 (research R20): an active session lands through the landing hooks.
  const ctx = sessionContext()
  if (cachedSession(ctx.queryClient)?.state === 'active') await continueAfterSignIn()
  else await rerouteCurrent(ctx.router)
}
</script>

<template>
  <section class="flex flex-col gap-5" aria-labelledby="pending-title">
    <div class="surface flex flex-col gap-3">
      <h1
        id="pending-title"
        tabindex="-1"
        class="text-2xl font-semibold text-gray-900 focus:outline-none dark:text-white"
      >
        {{ t('auth.pendingActions.title') }}
      </h1>
      <p class="text-gray-700 dark:text-gray-300">{{ t('auth.pendingActions.intro') }}</p>
      <p
        v-if="stillPending"
        class="rounded-xl border border-warning-200 bg-warning-50 p-4 text-warning-900 dark:border-warning-900 dark:bg-warning-950 dark:text-warning-100"
      >
        {{ t('auth.pendingActions.password.stillPending') }}
      </p>
      <ProblemMessage :problem="problem ?? registration.problem.value" />
      <p
        v-if="registration.messageKey.value"
        role="alert"
        class="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        {{ t(registration.messageKey.value) }}
      </p>
    </div>
    <ul class="flex flex-col gap-3">
      <PendingActionItem
        v-for="action in actions"
        :key="action"
        :action="action"
        :role="role"
        :can-register="soleSetup"
        :waits-for-password="action === 'secondFactorSetup' && !soleSetup"
        :supported="supported"
        :busy="action === 'passwordChange' ? checking : registration.pending.value"
        @check-again="checkAgain"
        @register="register"
      />
    </ul>
    <div class="flex flex-col gap-3">
      <p v-if="signOutFailed" role="alert" class="text-red-800 dark:text-red-200">
        {{ t('shell.signOutFailed') }}
      </p>
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline', class: 'w-full sm:w-auto sm:self-start' })"
        :disabled="signingOut"
        @click="signOut"
      >
        <LegacyText k="tfa.cancel_setup" />
      </button>
    </div>
  </section>
</template>
