// Mail queue handlers (UI 011 T014, T086): list with filters, sort, paging, truncation and the
// counts per queue; the content of a message; actions on up to the bulk limit of queue IDs with a
// result per ID; flush and purge. A stopped Postfix answers `409 mail-service-not-running`, and
// every operation honours the scenario's injections (`502 queue-action-failed`, `504
// outcome-unknown`, `Audit-Recorded: false`, delays).
import type { BulkItemResult, MailQueueMessage } from '@/api'

import { messageContent, type MockQueueMessage } from '../factories/mail-queue'
import type { ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem } from './context'
import { addViolation, compareValues, validationFailed, type Violations } from './domain-rules'
import { operationGate } from './operations-context'

const QUEUE_ID = /^[0-9A-Fa-f]{1,32}$/
const POSTFIX = 'postfix-mailcow'

function postfixStopped(state: ScenarioState): Response | null {
  return state.operations.mailQueue.postfixStopped
    ? problem(409, 'mail-service-not-running', { container: POSTFIX })
    : null
}

function view(message: MockQueueMessage): MailQueueMessage {
  const { content: _content, contentLength: _length, ...rest } = message
  return rest
}

function matches(message: MockQueueMessage, params: URLSearchParams): boolean {
  const q = params.get('q')?.trim().toLowerCase()
  const includes = (value: string | null | undefined, needle: string) =>
    (value ?? '').toLowerCase().includes(needle)
  if (
    q &&
    !(
      includes(message.id, q) ||
      includes(message.sender, q) ||
      message.recipients.some(
        (recipient) => includes(recipient.address, q) || includes(recipient.deferralReason, q),
      )
    )
  ) {
    return false
  }
  const queues = params.getAll('queue')
  if (queues.length > 0 && !queues.includes(message.queue)) return false
  const senders = params.getAll('sender').map((value) => value.toLowerCase())
  if (senders.length > 0 && !senders.some((sender) => includes(message.sender, sender))) {
    return false
  }
  const recipients = params.getAll('recipient').map((value) => value.toLowerCase())
  if (
    recipients.length > 0 &&
    !recipients.some((needle) => message.recipients.some((r) => includes(r.address, needle)))
  ) {
    return false
  }
  const from = params.get('from')
  const to = params.get('to')
  const arrival = Date.parse(message.arrivalTime)
  if (from && arrival < Date.parse(from)) return false
  if (to && arrival > Date.parse(to)) return false
  return true
}

const SORT_KEYS: Record<string, (message: MockQueueMessage) => unknown> = {
  arrivalTime: (message) => Date.parse(message.arrivalTime),
  size: (message) => message.sizeBytes,
  sender: (message) => message.sender,
  queue: (message) => message.queue,
  id: (message) => message.id,
}

function sorted(messages: MockQueueMessage[], sort: string, order: string): MockQueueMessage[] {
  const key = SORT_KEYS[sort] ?? SORT_KEYS.arrivalTime!
  const direction = order === 'desc' ? -1 : 1
  return [...messages].sort(
    (a, b) => direction * compareValues(key(a), key(b)) || compareValues(a.id, b.id),
  )
}

function queueCounts(state: ScenarioState) {
  const data = state.operations.mailQueue
  const counts = { active: 0, deferred: 0, hold: 0, incoming: 0, maildrop: 0, total: 0 }
  for (const message of data.messages) counts[message.queue] += 1
  counts.deferred += data.unlisted
  counts.total = data.messages.length + data.unlisted
  return counts
}

const bulkRequestId = (state: ScenarioState) =>
  Buffer.from(`mq${state.now()}`).toString('hex').padEnd(32, '0').slice(0, 32)

export const mailQueueHandlers = [
  http.get('/mail-queue/messages', async ({ request, response }) => {
    const gate = await operationGate('listMailQueueMessages')
    if (gate.stop) return response.untyped(gate.stop)
    const stopped = postfixStopped(gate.state)
    if (stopped) return response.untyped(stopped)
    const url = new URL(request.url)
    const params = url.searchParams
    const limit = Number(params.get('limit') ?? 25)
    const offset = Number(params.get('offset') ?? 0)
    const items = sorted(
      gate.state.operations.mailQueue.messages.filter((message) => matches(message, params)),
      params.get('sort') ?? 'arrivalTime',
      params.get('order') ?? 'asc',
    )
    return gate.finish(
      response(200).json({
        data: items.slice(offset, offset + limit).map(view),
        meta: {
          total: items.length,
          limit,
          offset,
          truncated: gate.state.operations.mailQueue.unlisted > 0,
          queueCounts: queueCounts(gate.state),
        },
      }),
    )
  }),

  http.post('/mail-queue/messages/bulk-actions', async ({ request, response }) => {
    const gate = await operationGate('bulkMailQueueMessages')
    if (gate.stop) return response.untyped(gate.stop)
    const refused = csrfProblem(gate.state, request)
    if (refused) return response.untyped(refused)
    const stopped = postfixStopped(gate.state)
    if (stopped) return response.untyped(stopped)
    const body = await request.json()
    const data = gate.state.operations.mailQueue
    const errors: Violations = {}
    const max = gate.state.operations.capabilities.limits.mailQueueBulkMaxIds
    if (body.targets.length > max) addViolation(errors, 'targets', 'tooMany', { max })
    body.targets.forEach((target, index) => {
      if (!QUEUE_ID.test(String(target.id))) {
        addViolation(errors, `targets.${index}.id`, 'invalidFormat', { format: 'queueId' })
      }
    })
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    // Messages delivered behind the app's back leave the queue before the action.
    if (data.vanishOnAction.length > 0) {
      const gone = new Set(data.vanishOnAction)
      data.messages = data.messages.filter((message) => !gone.has(message.id))
      data.vanishOnAction = []
    }
    const seen = new Set<string>()
    const results: BulkItemResult[] = []
    for (const target of body.targets) {
      const id = String(target.id)
      if (seen.has(id.toUpperCase())) continue
      seen.add(id.toUpperCase())
      const message = data.messages.find((item) => item.id.toUpperCase() === id.toUpperCase())
      if (!message) {
        results.push({ id, outcome: 'notFound' })
        continue
      }
      if (body.action === 'delete') {
        data.messages = data.messages.filter((item) => item !== message)
      } else if (body.action === 'hold') {
        message.queue = 'hold'
      } else if (body.action === 'release') {
        if (message.queue === 'hold') message.queue = 'deferred'
      } else if (message.queue === 'deferred') {
        message.queue = 'active'
      }
      results.push({ id, outcome: 'done' })
    }
    const count = (outcome: BulkItemResult['outcome']) =>
      results.filter((item) => item.outcome === outcome).length
    return gate.finish(
      response(200).json({
        data: {
          bulkRequestId: bulkRequestId(gate.state),
          results,
          summary: {
            total: results.length,
            done: count('done'),
            notFound: count('notFound'),
            refused: 0,
            outdated: 0,
            failed: 0,
          },
        },
      }),
    )
  }),

  http.get('/mail-queue/messages/{queueId}/content', async ({ params, response }) => {
    const gate = await operationGate('getMailQueueMessageContent')
    if (gate.stop) return response.untyped(gate.stop)
    const stopped = postfixStopped(gate.state)
    if (stopped) return response.untyped(stopped)
    const data = gate.state.operations.mailQueue
    const id = String(params.queueId)
    if (data.goneOnView.includes(id)) {
      data.messages = data.messages.filter((message) => message.id !== id)
      data.goneOnView = data.goneOnView.filter((item) => item !== id)
    }
    const message = data.messages.find((item) => item.id.toUpperCase() === id.toUpperCase())
    if (!message) return response.untyped(problem(404, null))
    return gate.finish(
      response(200).json({ data: { id: message.id, content: messageContent(message) } }),
    )
  }),

  http.post('/mail-queue/flush', async ({ request, response }) => {
    const gate = await operationGate('flushMailQueue')
    if (gate.stop) return response.untyped(gate.stop)
    const refused = csrfProblem(gate.state, request)
    if (refused) return response.untyped(refused)
    const stopped = postfixStopped(gate.state)
    if (stopped) return response.untyped(stopped)
    for (const message of gate.state.operations.mailQueue.messages) {
      if (message.queue === 'deferred') message.queue = 'active'
    }
    return gate.finish(
      response(200).json({
        data: { action: 'flush', completedAt: new Date(gate.state.now()).toISOString() },
      }),
    )
  }),

  http.post('/mail-queue/purge', async ({ request, response }) => {
    const gate = await operationGate('purgeMailQueue')
    if (gate.stop) return response.untyped(gate.stop)
    const refused = csrfProblem(gate.state, request)
    if (refused) return response.untyped(refused)
    const stopped = postfixStopped(gate.state)
    if (stopped) return response.untyped(stopped)
    gate.state.operations.mailQueue.messages = []
    gate.state.operations.mailQueue.unlisted = 0
    return gate.finish(
      response(200).json({
        data: { action: 'purge', completedAt: new Date(gate.state.now()).toISOString() },
      }),
    )
  }),
]
