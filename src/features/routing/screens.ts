// The six screens of the Routing section (data-model §2 RoutingScreen, FR-001), in the order of the
// index page and the section navigation, labelled with the classic interface's tab names (legacy
// form map part 1c). Each user story sets its screen to `available`.
import type { Role } from '@/api'
import type { LegacyKey } from '@/i18n'

export type RoutingScreenId =
  'relayhosts' | 'transports' | 'tlsPolicyMaps' | 'recipientMaps' | 'bccMaps' | 'forwardingHosts'

export interface RoutingScreen {
  id: RoutingScreenId
  routeName: string
  /** The legacy tab label (navigation). */
  labelKey: LegacyKey
  /** The legacy card heading of the list. */
  titleKey: LegacyKey
  /** The legacy hint above the list (HTML through `SanitizedHtml.vue`). */
  hintKey: LegacyKey
  roles: readonly Role[]
  status: 'pending' | 'available'
}

const ADMIN: readonly Role[] = ['admin']

export const ROUTING_SCREENS: readonly RoutingScreen[] = [
  {
    id: 'relayhosts',
    routeName: 'routing-relayhosts',
    labelKey: 'admin.relayhosts',
    titleKey: 'admin.relayhosts',
    hintKey: 'admin.relayhosts_hint',
    roles: ADMIN,
    status: 'available',
  },
  {
    id: 'transports',
    routeName: 'routing-transports',
    labelKey: 'admin.transport_maps',
    titleKey: 'admin.transport_maps',
    hintKey: 'admin.transports_hint',
    roles: ADMIN,
    status: 'available',
  },
  {
    id: 'tlsPolicyMaps',
    routeName: 'routing-tls-policy-maps',
    labelKey: 'mailbox.tls_policy_maps',
    titleKey: 'mailbox.tls_policy_maps_long',
    hintKey: 'mailbox.tls_policy_maps_info',
    roles: ADMIN,
    status: 'pending',
  },
  {
    id: 'recipientMaps',
    routeName: 'routing-recipient-maps',
    labelKey: 'mailbox.recipient_maps',
    titleKey: 'mailbox.recipient_maps',
    hintKey: 'mailbox.recipient_map_info',
    roles: ADMIN,
    status: 'pending',
  },
  {
    id: 'bccMaps',
    routeName: 'routing-bcc-maps',
    labelKey: 'mailbox.bcc_maps',
    titleKey: 'mailbox.bcc_maps',
    hintKey: 'mailbox.bcc_info',
    roles: ['admin', 'domainAdmin'],
    status: 'pending',
  },
  {
    id: 'forwardingHosts',
    routeName: 'routing-forwarding-hosts',
    labelKey: 'admin.forwarding_hosts',
    titleKey: 'admin.forwarding_hosts',
    hintKey: 'admin.forwarding_hosts_hint',
    roles: ADMIN,
    status: 'pending',
  },
]

export function findScreen(id: RoutingScreenId): RoutingScreen {
  return ROUTING_SCREENS.find((screen) => screen.id === id)!
}
