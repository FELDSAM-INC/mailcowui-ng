// Password sign-in (FR-016–FR-019, FR-028, FR-091). The username is trimmed, the password is
// cleared after every attempt and never stored, and a role screen names its role. A failure shows
// one generic message, keeps the username and moves focus to the password field. A deliberately
// delayed answer keeps the busy state: requests have no client-side timeout.
import { nextTick, ref, shallowRef, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { ApiProblem, isApiProblem, type Role } from '@/api'
import { useSessionStore } from '@/app/session/store'
import { useProblemMessages } from '@/i18n/problems'
import { announce } from '@/shared/composables/useAnnouncer'
import { useProblemForm } from '@/shared/composables/useProblemForm'

import { acceptSession, createSession } from '../api'
import { useThrottle } from './useThrottle'

export interface PasswordSignInOptions {
  role: () => Role | null
  usernameId: string
  passwordId: string
  /** Called once a valid attempt is about to be sent (US2 aborts the conditional passkey request). */
  onSubmit?: () => void
  /** Called after an attempt that did not sign in (US2 restarts the conditional request). */
  onFailed?: () => void
}

function asProblem(error: unknown): ApiProblem {
  return isApiProblem(error) ? error : ApiProblem.fromParts({ kind: 'network', cause: error })
}

export function usePasswordSignIn(options: PasswordSignInOptions) {
  const { t } = useI18n()
  const { problemMessage } = useProblemMessages()
  const store = useSessionStore()
  const username = ref(store.keptUsername ?? '')
  const password = ref('')
  const pending = ref(false)
  /** A problem that is not about one field: the generic failure, throttling, a lost connection. */
  const problem: Ref<ApiProblem | null> = shallowRef(null)
  const throttle = useThrottle()
  const form = useProblemForm({
    fieldId: (path) =>
      path === 'username' ? options.usernameId : path === 'password' ? options.passwordId : null,
  })

  function focusPassword() {
    void nextTick(() => document.getElementById(options.passwordId)?.focus())
  }

  async function submit(): Promise<void> {
    if (pending.value || throttle.active.value) return
    const name = username.value.trim()
    const errors: Record<string, string[]> = {}
    if (!name) errors.username = ['validation.required']
    if (!password.value) errors.password = ['validation.required']
    problem.value = null
    if (Object.keys(errors).length > 0) {
      await form.setClientErrors(errors)
      return
    }
    form.clear()
    pending.value = true
    options.onSubmit?.()
    announce(t('auth.signIn.submitting'))
    const role = options.role()
    try {
      const session = await createSession({
        username: name,
        password: password.value,
        ...(role ? { role } : {}),
      })
      password.value = ''
      await acceptSession(session)
    } catch (error) {
      password.value = ''
      await fail(asProblem(error))
      options.onFailed?.()
    } finally {
      pending.value = false
    }
  }

  async function fail(failure: ApiProblem): Promise<void> {
    if (failure.is('validation-failed') && failure.fieldErrors.size > 0) {
      await form.setProblem(failure)
      return
    }
    problem.value = failure
    if (failure.is('too-many-requests')) {
      throttle.start(failure.retryAfter)
    } else {
      announce(problemMessage(failure), { assertive: true })
    }
    focusPassword()
  }

  return { username, password, pending, problem, throttle, form, submit }
}
