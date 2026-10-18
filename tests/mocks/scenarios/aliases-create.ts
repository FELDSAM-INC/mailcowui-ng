// UI 004 US2 scenarios (T041): creating aliases. The base world holds an address of each kind of
// holder (CREATE_HOLDERS_004).
import {
  DOMAIN_ADMIN_004,
  MAILBOX_004,
  RESOURCE_004,
  TEMPORARY_ALIAS_004,
  setupWorld004,
} from './feature-004-base'
import type { ScenarioDefinition } from './index'

/** Addresses already in use, by holder (US2-AS4), and one that reaches a mailbox through example.net. */
export const CREATE_HOLDERS_004 = {
  mailbox: MAILBOX_004.anna,
  resource: RESOURCE_004.meetingRoom,
  alias: 'sales@example.org',
  temporaryAlias: TEMPORARY_ALIAS_004,
  throughAliasDomain: 'anna@example.net',
} as const

export const aliasesCreateScenarios: Record<string, ScenarioDefinition> = {
  'aliases-create': {
    description:
      'An administrator in the base world, where anna@example.org (mailbox), MeetingRoom1@example.org (resource), sales@example.org (alias) and spam9f3k2@example.org (temporary alias) are in use (UI 004 US2).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => setupWorld004(state),
  },
  'aliases-create-limit': {
    description:
      'An administrator; example.org (with example.net) is at its alias limit (US2-AS5).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => {
      setupWorld004(state)
      const domain = state.domains.find((item) => item.name === 'example.org')!
      domain.maxAliases = domain.usage.aliases
    },
  },
  'aliases-create-da-no-external': {
    description:
      'The domain administrator of example.org and example.com without aliasExternalGoto (US2-AS7).',
    overrides: { signedInAs: DOMAIN_ADMIN_004 },
    setup: (state) => setupWorld004(state),
  },
  'aliases-create-network': {
    description:
      'As aliases-create; the end-to-end test aborts the n-th createAlias request (US2 edge case).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => setupWorld004(state),
  },
}
