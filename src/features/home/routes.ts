// The home screen route (data-model §5).
import type { RouteRecordRaw } from 'vue-router'

export const homeRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/app/states/LandingPage.vue'),
    meta: { layout: 'shell', access: 'session', navEntry: 'home', titleKey: 'home.title' },
  },
]
