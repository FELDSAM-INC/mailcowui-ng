import { defineAsyncComponent } from 'vue'
export { canSignInAs, type ActingTarget } from './eligibility'
export { useActingState } from './composables/useActingState'
export const SignInAsAction = defineAsyncComponent(() => import('./components/SignInAsAction.vue'))
export const ActingUnavailableNotice = defineAsyncComponent(
  () => import('./components/ActingUnavailableNotice.vue'),
)
export { actingRequestPending, returnFromActing } from './actions'
