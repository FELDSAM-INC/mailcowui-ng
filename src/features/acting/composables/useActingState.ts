import { computed } from 'vue'
import { useIdentityQuery } from '@/app/session/queries'

export function useActingState() {
  const identity = useIdentityQuery()
  const impersonation = computed(() => identity.data.value?.impersonation)
  return {
    isActing: computed(() => !!impersonation.value),
    target: computed(() => impersonation.value?.target),
    impersonator: computed(() => impersonation.value?.impersonator),
    startedAt: computed(() => impersonation.value?.startedAt),
  }
}
