// Asks before leaving a form with unsaved changes or a running action (UI 002 research D21,
// FR-028, FR-038, FR-048, FR-062). While armed it guards leaving the route and changing its path,
// and registers a `beforeunload` listener. Query-only changes on the same path (a section's
// `edit`, a step's `step`) are left to the page, which asks itself where needed.
import { computed, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'

import { confirm } from './useConfirm'

export interface LeaveGuardTexts {
  /** Translation key of the question's explanation. */
  messageKey: string
  titleKey?: string
  leaveKey?: string
  stayKey?: string
}

export function useLeaveGuard(
  shouldGuard: MaybeRefOrGetter<boolean>,
  texts: LeaveGuardTexts | string,
) {
  const { t } = useI18n()
  const options: LeaveGuardTexts = typeof texts === 'string' ? { messageKey: texts } : texts
  const disarmed = ref(false)
  const armed = computed(() => !disarmed.value && toValue(shouldGuard))

  /** Asks the question; resolves true when the user chooses to leave. */
  function ask(): Promise<boolean> {
    return confirm({
      title: t(options.titleKey ?? 'leaveGuard.title'),
      description: t(options.messageKey),
      confirmLabel: t(options.leaveKey ?? 'leaveGuard.leave'),
      cancelLabel: t(options.stayKey ?? 'leaveGuard.stay'),
      destructive: true,
    })
  }

  // UI 008: going to an authentication screen (the session ended, or a sign-out) never asks: the
  // input cannot be saved without a session, and the question would block the sign-in screen.
  onBeforeRouteLeave((to) => (armed.value && to.meta.layout !== 'auth' ? ask() : true))
  onBeforeRouteUpdate((to, from) => (armed.value && to.path !== from.path ? ask() : true))

  function onBeforeUnload(event: BeforeUnloadEvent) {
    event.preventDefault()
    // Older browsers show the prompt only when returnValue is set.
    event.returnValue = ''
  }

  let listening = false
  function listen(on: boolean) {
    if (on === listening) return
    listening = on
    if (on) window.addEventListener('beforeunload', onBeforeUnload)
    else window.removeEventListener('beforeunload', onBeforeUnload)
  }

  watch(armed, listen, { immediate: true })
  onScopeDispose(() => listen(false))

  return {
    armed,
    ask,
    /** Stops guarding, for example right before navigating away after a successful save. */
    disarm() {
      disarmed.value = true
    },
    arm() {
      disarmed.value = false
    },
  }
}
