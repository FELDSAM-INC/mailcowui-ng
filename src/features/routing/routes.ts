// The routes of UI 009 (data-model §5). Every page is a lazy chunk, loaded with the feature's own
// strings (`loadFeatureMessages('routing')`). Every route belongs to the `routing` catalogue
// entry; all but the index and the BCC map routes are for administrators only (`meta.roles`), so
// a domain administrator gets "no access" in place and no request is sent. The literal `new`
// segments come before the parameter routes.
import type { RouteRecordRaw } from 'vue-router'

import type { Role } from '@/api'
import { legacy, loadFeatureMessages, type TextRef } from '@/i18n'

function page<T>(load: () => Promise<T>): () => Promise<T> {
  return () => Promise.all([load(), loadFeatureMessages('routing')]).then(([module]) => module)
}

function route(
  path: string,
  name: string,
  component: () => Promise<unknown>,
  titleKey: TextRef,
  options: { roles?: Role[]; props?: Record<string, unknown> } = {},
): RouteRecordRaw {
  return {
    path,
    name,
    component: page(component as () => Promise<never>),
    ...(options.props ? { props: options.props } : {}),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'routing',
      titleKey,
      ...(options.roles ? { roles: options.roles } : {}),
    },
  }
}

const ADMIN: Role[] = ['admin']

export const routingRoutes: RouteRecordRaw[] = [
  route(
    '/routing',
    'routing',
    () => import('./pages/RoutingIndexPage.vue'),
    legacy('admin.routing'),
  ),
  // US1: Sender-dependent transports.
  route(
    '/routing/relayhosts',
    'routing-relayhosts',
    () => import('./pages/relayhosts/RelayhostsPage.vue'),
    legacy('admin.relayhosts'),
    { roles: ADMIN },
  ),
  route(
    '/routing/relayhosts/new',
    'routing-relayhost-create',
    () => import('./pages/relayhosts/RelayhostCreatePage.vue'),
    legacy('admin.add_relayhost'),
    { roles: ADMIN },
  ),
  route(
    '/routing/relayhosts/:relayhostId(\\d+)',
    'routing-relayhost-edit',
    () => import('./pages/relayhosts/RelayhostEditPage.vue'),
    legacy('edit.title'),
    { roles: ADMIN },
  ),
  route(
    '/routing/relayhosts/:relayhostId(\\d+)/usage',
    'routing-relayhost-usage',
    () => import('./pages/relayhosts/RelayhostUsagePage.vue'),
    legacy('admin.in_use_by'),
    { roles: ADMIN },
  ),
  // US3: Transport Maps.
  route(
    '/routing/transports',
    'routing-transports',
    () => import('./pages/transports/TransportsPage.vue'),
    legacy('admin.transport_maps'),
    { roles: ADMIN },
  ),
  route(
    '/routing/transports/new',
    'routing-transport-create',
    () => import('./pages/transports/TransportCreatePage.vue'),
    legacy('admin.add_transport'),
    { roles: ADMIN },
  ),
  route(
    '/routing/transports/:transportId(\\d+)',
    'routing-transport-edit',
    () => import('./pages/transports/TransportEditPage.vue'),
    legacy('edit.title'),
    { roles: ADMIN },
  ),
]
