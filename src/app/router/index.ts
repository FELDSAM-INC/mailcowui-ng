// The app's router (research R19): history mode under the Vite base `/ng/`, the route map, the
// session guard, focus management and the document title.
import { createRouter, createWebHistory, type RouterHistory } from 'vue-router'

import { buildRoutes } from './routes'

export function createAppRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
) {
  return createRouter({
    history,
    routes: buildRoutes(),
    scrollBehavior(to, _from, saved) {
      if (saved) return saved
      if (to.hash) return { el: to.hash }
      return { top: 0 }
    },
  })
}
