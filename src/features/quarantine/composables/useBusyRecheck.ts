// The single re-check of a busy item (UI 006 data-model §8 "Busy re-check", FR-030): one timer per
// item page, started by `quarantine-item-busy` and cancelled on leaving the page or by any new
// action. It only reads the item again; it never sends an action.
import { onScopeDispose, ref } from 'vue'

export function useBusyRecheck() {
  let timer: ReturnType<typeof setTimeout> | undefined
  const pending = ref(false)

  function cancel() {
    if (timer) clearTimeout(timer)
    timer = undefined
    pending.value = false
  }

  /** Runs `check` once after `seconds`; a newer schedule replaces an older one. */
  function schedule(seconds: number, check: () => unknown) {
    cancel()
    pending.value = true
    timer = setTimeout(
      () => {
        timer = undefined
        pending.value = false
        void check()
      },
      Math.max(0, seconds) * 1000,
    )
  }

  onScopeDispose(cancel)
  return { pending, schedule, cancel }
}
