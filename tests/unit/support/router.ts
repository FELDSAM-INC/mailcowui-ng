// A test router with the app's route map and stand-ins for the routes later stories register.
// Route components are replaced by stubs, so tests never load page chunks.
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type RouteRecordRaw, type Router } from 'vue-router'

import { buildRoutes } from '@/app/router/routes'

const Stub = defineComponent({
  name: 'RouteStub',
  setup: () => () => h('h1', { tabindex: -1 }, 'stub'),
})

/** Routes of the route map (data-model §5) that arrive with the user stories. */
const STORY_ROUTES: RouteRecordRaw[] = [
  {
    path: '/sign-in',
    name: 'sign-in',
    component: Stub,
    meta: { layout: 'auth', access: 'anonymous' },
  },
  {
    path: '/sign-in/admin',
    name: 'sign-in-admin',
    component: Stub,
    meta: { layout: 'auth', access: 'anonymous' },
  },
  {
    path: '/sign-in/domain-admin',
    name: 'sign-in-domain-admin',
    component: Stub,
    meta: { layout: 'auth', access: 'anonymous' },
  },
  {
    path: '/sign-in/mailbox-user',
    name: 'sign-in-mailbox-user',
    component: Stub,
    meta: { layout: 'auth', access: 'anonymous' },
  },
  {
    path: '/sign-in/second-factor',
    name: 'sign-in-second-factor',
    component: Stub,
    meta: { layout: 'auth', access: 'pendingSecondFactor' },
  },
  {
    path: '/pending-actions',
    name: 'pending-actions',
    component: Stub,
    meta: { layout: 'auth', access: 'restricted' },
  },
  {
    path: '/api-keys/new',
    name: 'api-key-create',
    component: Stub,
    meta: { layout: 'shell', access: 'session', navEntry: 'apiKeys' },
  },
]

export function createTestRouter(): Router {
  // Account and settings tabs nest their pages. Stub those too: route-only tests must not load
  // production page chunks (especially when coverage instruments a child's imports).
  const stubRoute = (route: RouteRecordRaw): RouteRecordRaw =>
    ({ ...route, component: Stub, children: route.children?.map(stubRoute) }) as RouteRecordRaw
  const routes = buildRoutes().map(stubRoute)
  const router = createRouter({ history: createMemoryHistory('/ng/'), routes })
  for (const route of STORY_ROUTES) {
    if (!router.hasRoute(route.name as string)) router.addRoute(route)
  }
  return router
}
