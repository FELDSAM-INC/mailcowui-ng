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
  { path: '/routing', name: 'routing', redirect: { name: 'routing-bcc-maps' } },
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
  // US4: the connection test.
  route(
    '/routing/relayhosts/:relayhostId(\\d+)/test',
    'routing-relayhost-test',
    () => import('./pages/ConnectionTestPage.vue'),
    'routing.connectionTest.title',
    { roles: ADMIN, props: { kind: 'relayhost' } },
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
  route(
    '/routing/transports/:transportId(\\d+)/test',
    'routing-transport-test',
    () => import('./pages/ConnectionTestPage.vue'),
    'routing.connectionTest.title',
    { roles: ADMIN, props: { kind: 'transport' } },
  ),
  // US5: BCC maps, for administrators and domain administrators (read-only without the flag).
  route(
    '/routing/bcc-maps',
    'routing-bcc-maps',
    () => import('./pages/bcc-maps/BccMapsPage.vue'),
    legacy('mailbox.bcc_maps'),
  ),
  route(
    '/routing/bcc-maps/new',
    'routing-bcc-map-create',
    () => import('./pages/bcc-maps/BccMapCreatePage.vue'),
    legacy('mailbox.add_bcc_entry'),
  ),
  route(
    '/routing/bcc-maps/:bccMapId(\\d+)',
    'routing-bcc-map-edit',
    () => import('./pages/bcc-maps/BccMapEditPage.vue'),
    legacy('edit.title'),
  ),
  // US6: TLS policy maps (one page for adding and editing, as legacy's forms are the same).
  route(
    '/routing/tls-policy-maps',
    'routing-tls-policy-maps',
    () => import('./pages/tls-policy-maps/TlsPolicyMapsPage.vue'),
    legacy('mailbox.tls_policy_maps_long'),
    { roles: ADMIN },
  ),
  route(
    '/routing/tls-policy-maps/new',
    'routing-tls-policy-map-create',
    () => import('./pages/tls-policy-maps/TlsPolicyMapFormPage.vue'),
    legacy('mailbox.add_tls_policy_map'),
    { roles: ADMIN },
  ),
  route(
    '/routing/tls-policy-maps/:tlsPolicyMapId(\\d+)',
    'routing-tls-policy-map-edit',
    () => import('./pages/tls-policy-maps/TlsPolicyMapFormPage.vue'),
    legacy('edit.title'),
    { roles: ADMIN },
  ),
  // US7: recipient maps.
  route(
    '/routing/recipient-maps',
    'routing-recipient-maps',
    () => import('./pages/recipient-maps/RecipientMapsPage.vue'),
    legacy('mailbox.recipient_maps'),
    { roles: ADMIN },
  ),
  route(
    '/routing/recipient-maps/new',
    'routing-recipient-map-create',
    () => import('./pages/recipient-maps/RecipientMapFormPage.vue'),
    legacy('mailbox.add_recipient_map_entry'),
    { roles: ADMIN },
  ),
  route(
    '/routing/recipient-maps/:recipientMapId(\\d+)',
    'routing-recipient-map-edit',
    () => import('./pages/recipient-maps/RecipientMapFormPage.vue'),
    legacy('edit.title'),
    { roles: ADMIN },
  ),
  // US8: forwarding hosts (legacy has no entry page for them).
  route(
    '/routing/forwarding-hosts',
    'routing-forwarding-hosts',
    () => import('./pages/forwarding-hosts/ForwardingHostsPage.vue'),
    legacy('admin.forwarding_hosts'),
    { roles: ADMIN },
  ),
  route(
    '/routing/forwarding-hosts/new',
    'routing-forwarding-host-create',
    () => import('./pages/forwarding-hosts/ForwardingHostCreatePage.vue'),
    legacy('admin.add_forwarding_host'),
    { roles: ADMIN },
  ),
]
