// Mail queue area of the operations scenarios (UI 011 T013, T087): the queued messages, the
// messages Postfix reports beyond the listing limit, the state of the Postfix container, and IDs
// that leave the queue behind the app's back; the seed of `admin-operations` and the area's
// scenarios.
import {
  largeQueue,
  queueMessage,
  standardQueue,
  type MockQueueMessage,
} from '../../factories/mail-queue'
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'

export interface MailQueueData {
  messages: MockQueueMessage[]
  /** Messages Postfix reports beyond the listed ones (counted, never listed): a truncated list. */
  unlisted: number
  /** The Postfix container is not running: every queue operation answers 409. */
  postfixStopped: boolean
  /** IDs that leave the queue (delivered elsewhere) just before the next queue action. */
  vanishOnAction: string[]
  /** IDs whose content is gone (the message left the queue) when it is viewed. */
  goneOnView: string[]
}

export interface MailQueuePatch {
  /** Adds messages, for example ones that arrive while a dialog is open. */
  add?: MockQueueMessage[]
  remove?: string[]
  postfixStopped?: boolean
}

export function initialMailQueueData(): MailQueueData {
  return { messages: [], unlisted: 0, postfixStopped: false, vanishOnAction: [], goneOnView: [] }
}

/** Applies runtime changes (`PATCH /__mock/scenarios/:id` with `operations.mailQueue`). */
export function applyMailQueuePatch(state: ScenarioState, patch: MailQueuePatch): void {
  const data = state.operations.mailQueue
  if (patch.add) data.messages.push(...patch.add)
  if (patch.remove) {
    const gone = new Set(patch.remove)
    data.messages = data.messages.filter((message) => !gone.has(message.id))
  }
  if (patch.postfixStopped !== undefined) data.postfixStopped = patch.postfixStopped
}

/** The healthy installation's queue, seeded into every operations scenario. */
export function seedMailQueue(state: ScenarioState): void {
  state.operations.mailQueue.messages = standardQueue(state.now())
}

/** Scenarios of this area; `setup` runs after the seed of every area. */
export const mailQueueScenarios: Record<string, ScenarioDefinition> = {
  'ops-queue': {
    description:
      'An administrator with 8 queued messages, 3 of them deferred to partner.example, one bounce, one held message, and a 10 MiB message (UI 011 US4).',
    setup(state) {
      // A 10 MiB message with multi-byte characters for the content viewer (SC-011).
      state.operations.mailQueue.messages.push(
        queueMessage(state.now(), {
          id: 'C2739415A6',
          queue: 'deferred',
          arrivalTime: new Date(state.now() - 300 * 60_000).toISOString(),
          sizeBytes: 10 * 1024 * 1024,
          sender: 'big@example.org',
          recipients: [{ address: 'archive@example.net', deferralReason: 'Message too large' }],
          contentLength: 10 * 1024 * 1024,
        }),
      )
    },
  },
  'ops-queue-large': {
    description:
      'A queue of 12,000 reported messages, of which 10,000 are listed: 1,400 held from spam@compromised.example (UI 011 FR-052).',
    setup(state) {
      state.operations.mailQueue.messages = largeQueue(state.now())
      state.operations.mailQueue.unlisted = 2_000
    },
  },
  'ops-queue-empty': {
    description: 'An administrator with an empty mail queue (UI 011 FR-062).',
    setup(state) {
      state.operations.mailQueue.messages = []
    },
  },
  'ops-queue-postfix-stopped': {
    description: 'The Postfix container is not running (UI 011 US4-AS7, FR-060).',
    setup(state) {
      state.operations.mailQueue.postfixStopped = true
    },
  },
  'ops-queue-timeout': {
    description: 'Queue actions time out with an unknown outcome (UI 011 FR-059).',
    overrides: {
      operations: {
        inject: {
          bulkMailQueueMessages: {
            status: 504,
            problemType: 'outcome-unknown',
            extensions: { step: 'hold' },
          },
          flushMailQueue: {
            status: 504,
            problemType: 'outcome-unknown',
            extensions: { step: 'flush' },
          },
        },
      },
    },
  },
  'ops-queue-failure': {
    description: 'Postfix refuses queue actions with a message (UI 011 FR-059).',
    overrides: {
      operations: {
        inject: {
          bulkMailQueueMessages: {
            status: 502,
            problemType: 'queue-action-failed',
            extensions: { serviceMessage: 'postsuper: fatal: queue file is locked' },
          },
        },
      },
    },
  },
  'ops-queue-vanishing': {
    description:
      'One message is delivered before an action on it, and one leaves the queue before its content is viewed (UI 011 US4-AS2).',
    setup(state) {
      state.operations.mailQueue.vanishOnAction = ['6C1D3E5F20']
      state.operations.mailQueue.goneOnView = ['7D2E4F6031']
    },
  },
}
