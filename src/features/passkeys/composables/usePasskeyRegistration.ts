// Registering a passkey (FR-053, FR-039, research R14), for the passkeys page and the
// pending-actions screen: registration options, the device's create(), then POST /me/passkeys
// with an optional name. A cancelled prompt registers nothing and shows nothing. A registered
// passkey can lift a pending second-factor setup, so the session and the identity are read again
// and the other tabs are told when the session state changed.
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { ApiProblem, isApiProblem, queryKeys, type Passkey } from '@/api'
import { sessionContext } from '@/app/session/context'
import { cachedSession, identityQuery, isSignedIn, sessionQuery } from '@/app/session/queries'
import { useProblemMessages } from '@/i18n/problems'
import { announce } from '@/shared/composables/useAnnouncer'
import {
  createRegistration,
  WebAuthnCeremonyError,
  webAuthnMessageKey,
} from '@/shared/platform/webauthn'

import { createRegistrationOptions, registerPasskey } from '../api'

export function usePasskeyRegistration() {
  const { t } = useI18n()
  const { problemMessage } = useProblemMessages()
  const pending = ref(false)
  const problem = shallowRef<ApiProblem | null>(null)
  const messageKey = ref<string | null>(null)

  function report(error: unknown) {
    if (error instanceof WebAuthnCeremonyError) {
      const key = webAuthnMessageKey(error.kind)
      if (key) {
        messageKey.value = key
        announce(t(key), { assertive: true })
      }
      return
    }
    problem.value = isApiProblem(error)
      ? error
      : ApiProblem.fromParts({ kind: 'network', cause: error })
    if (!problem.value.is('validation-failed')) {
      announce(problemMessage(problem.value), { assertive: true })
    }
  }

  async function afterRegistration(): Promise<void> {
    const ctx = sessionContext()
    void ctx.queryClient.invalidateQueries({ queryKey: queryKeys.passkeys.all() })
    const before = cachedSession(ctx.queryClient)?.state
    try {
      const session = await ctx.queryClient.fetchQuery({ ...sessionQuery(), staleTime: 0 })
      if (isSignedIn(session)) {
        await ctx.queryClient.fetchQuery({ ...identityQuery(), staleTime: 0 })
      }
      if (before !== session.state) ctx.channel.post({ v: 1, type: 'session-changed' })
    } catch {
      // The guard reads the session again on the next navigation.
    }
  }

  /** Registers a passkey; resolves with it, or with null when nothing was registered. */
  async function register(name?: string): Promise<Passkey | null> {
    if (pending.value) return null
    pending.value = true
    problem.value = null
    messageKey.value = null
    try {
      const options = await createRegistrationOptions()
      const credential = await createRegistration(options.publicKey)
      const trimmed = name?.trim()
      const passkey = await registerPasskey({ credential, ...(trimmed ? { name: trimmed } : {}) })
      await afterRegistration()
      announce(t('passkeys.added'))
      return passkey
    } catch (error) {
      report(error)
      return null
    } finally {
      pending.value = false
    }
  }

  return { pending, problem, messageKey, register }
}
