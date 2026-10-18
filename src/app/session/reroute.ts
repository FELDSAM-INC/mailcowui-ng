// Re-runs the router guard for the current address, so that it follows a changed session state.
import type { Router } from 'vue-router'

export async function rerouteCurrent(router: Router): Promise<void> {
  const current = router.currentRoute.value
  await router.replace({
    path: current.path,
    query: current.query,
    hash: current.hash,
    force: true,
  })
}
