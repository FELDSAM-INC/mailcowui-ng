import type { ScenarioDefinition } from '../index'
import { ANNA, seedAnna } from './seed'
import { ensureMailbox } from './state'

export const overviewScenarios: Record<string, ScenarioDefinition> = {
  'account-mailbox-no-imap': {
    description: 'Own overview with IMAP denied and the other protocols allowed.',
    setup: (state) => {
      seedAnna(state)
      const mailbox = state.mailboxes.find((item) => item.localPart === 'anna')!
      mailbox.protocolAccess.imap = false
    },
    overrides: { signedInAs: ANNA },
  },
  'account-mailbox-unlimited-quota': {
    description: 'Own overview with unlimited storage.',
    setup: (state) => {
      seedAnna(state)
      ensureMailbox(state, ANNA, { quota: 0 })
    },
    overrides: { signedInAs: ANNA },
  },
  'account-mailbox-webmail-redirect': {
    description: 'Anonymous Anna has chosen webmail as her default landing.',
    setup: (state) => {
      seedAnna(state)
      ensureMailbox(state, ANNA, { webmailRedirect: true })
      state.accounts.find((account) => account.username === ANNA)!.secondFactors = []
    },
  },
  'account-mailbox-impersonated': {
    description: 'An administrator impersonates Anna: no own webmail action or forwarding.',
    setup: (state) => {
      seedAnna(state)
      state.accounts.find((account) => account.username === ANNA)!.impersonation = {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        impersonator: { username: 'admin', role: 'admin', authMethod: 'password' },
        target: { username: ANNA, role: 'mailboxUser' },
        startedAt: '2026-10-20T10:00:00Z',
      }
    },
    overrides: { signedInAs: ANNA },
  },
}
