// UI 004 US7 scenarios (T090): resources of each kind and booking rule, five desks for a mass
// deletion, and smaller limits in the capabilities. Changes and deletions behind the app's back use
// `changeElsewhere` and `deleteElsewhere`.
import { mockResource } from '../factories/resource'
import { DOMAIN_ADMIN_004, RESOURCE_004, setupWorld004, syncUsage004 } from './feature-004-base'
import type { ScenarioDefinition } from './index'
import type { ScenarioState } from './state'

export const RESOURCES_004 = {
  /** location, unlimited ("Soft limit"). */
  meetingRoom: RESOURCE_004.meetingRoom,
  /** thing, always free. */
  projector: RESOURCE_004.projector,
  /** group, limited to 2 ("Hard limit (2)"), outside the domain administrator's scope. */
  teamCalendar: RESOURCE_004.teamCalendar,
  /** location, limited to 5. */
  boardRoom: 'BoardRoom@example.org',
  /** thing, unlimited, inactive. */
  van: 'Van@example.com',
  /** Five things for a mass deletion (US6-AS3). */
  desks: [
    'Desk1@example.org',
    'Desk2@example.org',
    'Desk3@example.org',
    'Desk4@example.org',
    'Desk5@example.org',
  ],
} as const

function setupResources(state: ScenarioState): void {
  setupWorld004(state)
  state.resources.push(
    mockResource({
      description: 'Board Room',
      domain: 'example.org',
      kind: 'location',
      bookingRule: 'limited',
      bookingLimit: 5,
    }),
    mockResource({ description: 'Van', domain: 'example.com', kind: 'thing', active: false }),
    ...[1, 2, 3, 4, 5].map((n) =>
      mockResource({ description: `Desk ${n}`, domain: 'example.org', kind: 'thing' }),
    ),
  )
  syncUsage004(state)
}

export const resourceScenarios: Record<string, ScenarioDefinition> = {
  resources: {
    description:
      'An administrator with resources of each kind and booking rule, among them MeetingRoom1@example.org, and five desks (RESOURCES_004) (UI 004 US7).',
    overrides: { signedInAs: 'admin' },
    setup: setupResources,
  },
  'resources-da': {
    description: 'The same resources as the domain administrator of example.org and example.com.',
    overrides: { signedInAs: DOMAIN_ADMIN_004 },
    setup: setupResources,
  },
  'resources-limits': {
    description:
      'An administrator; descriptions may have at most 40 characters and the booking limit is 1 to 10.',
    overrides: {
      signedInAs: 'admin',
      capabilities004: {
        resourceDescriptionMaxLength: 40,
        resourceBookingLimit: { min: 1, max: 10 },
      },
    },
    setup: setupResources,
  },
}
