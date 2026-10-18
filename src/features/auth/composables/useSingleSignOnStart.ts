// Starting single sign-on (UI 012 research R4, FR-043, FR-044). One start at a time: the action is
// busy until the browser leaves for the provider. A running WebAuthn ceremony is aborted first,
// the authorization address must be an absolute http or https address (anything else is never
// opened), the requested in-app address is kept for this tab just before leaving, and the provider
// opens in the same tab. "Single sign-on not available" refreshes the public configuration, which
// hides the action. When the browser restores the page from its back-forward cache, the action is
// usable again.
import { useQueryClient } from '@tanstack/vue-query'
import { onScopeDispose, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { ApiProblem, isApiProblem, queryKeys, reportSessionProblem } from '@/api'
import { announce } from '@/shared/composables/useAnnouncer'
import { abortCeremony } from '@/shared/platform/webauthn'
import { safeHref } from '@/shared/security/safe-url'

import { startSingleSignOn } from '../api'
import { keepReturnTo } from '../sso/return-to'

export interface SingleSignOnStartOptions {
  /** The in-app address to open after the sign-in, validated before it is kept. */
  returnTo: () => unknown
  /** Leaves for the provider; `location.assign` (tests pass their own). */
  navigate?: (url: string) => void
  /** Called once a start begins (the sign-in page stops its conditional passkey request). */
  onStart?: () => void
}

/** Only absolute http and https addresses are opened (`safeHref` also allows app paths). */
function providerAddress(value: string): string | null {
  const href = safeHref(value)
  return href && /^https?:\/\//i.test(href) ? href : null
}

export function useSingleSignOnStart(options: SingleSignOnStartOptions) {
  const { t } = useI18n()
  const router = useRouter()
  const queryClient = useQueryClient()
  const pending = ref(false)
  const problem = shallowRef<ApiProblem | null>(null)
  const navigate = options.navigate ?? ((url: string) => window.location.assign(url))

  async function start(): Promise<void> {
    if (pending.value) return
    pending.value = true
    problem.value = null
    announce(t('auth.sso.starting'))
    abortCeremony()
    options.onStart?.()
    try {
      const { authorizationUrl } = await startSingleSignOn()
      const href = providerAddress(authorizationUrl)
      if (!href) throw ApiProblem.fromParts({ kind: 'problem', status: 500 })
      keepReturnTo(options.returnTo(), router)
      // The page is left: the action stays busy until the browser shows another page.
      navigate(href)
    } catch (error) {
      const failure = isApiProblem(error)
        ? error
        : ApiProblem.fromParts({ kind: 'network', cause: error })
      problem.value = failure
      pending.value = false
      reportSessionProblem(failure)
      if (failure.is('single-sign-on-not-available')) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.publicConfig() })
      }
    }
  }

  // Back from the provider's page: a page restored from the back-forward cache keeps its state.
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) pending.value = false
  }
  window.addEventListener('pageshow', onPageShow)
  onScopeDispose(() => window.removeEventListener('pageshow', onPageShow))

  return { pending, problem, start }
}
