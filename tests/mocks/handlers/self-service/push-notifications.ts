import type { PushNotificationSettingsReplacement, Writable } from '@/api'
import { addressOf } from '../../factories/mailbox'
import { mockPushSettings, pushEtag, pushSettingsView } from '../../factories/push-settings'
import { mailboxSelfService } from '../../scenarios/self-service/state'
import { csrfProblem, http, problem, requireAccount, scenario } from '../context'
import { addViolation, validationFailed, type Violations } from '../domain-rules'
import { flagRefusal, outage, preconditionFailed, reachMailbox } from './rules'

function scope(mailbox: string, request: Request, change: boolean) {
  const state = scenario()
  if (change) {
    const csrf = csrfProblem(state, request)
    if (csrf) return csrf
  }
  const account = requireAccount(state)
  if (account instanceof Response) return account
  const found = reachMailbox(state, account, mailbox)
  if (found instanceof Response) return found
  if (change) {
    const denied = flagRefusal(account, 'pushover')
    if (denied) return denied
  }
  return mailboxSelfService(state, mailbox)
}
function active(mailbox: string, value: boolean) {
  const item = scenario().mailboxes.find((entry) => addressOf(entry) === mailbox.toLowerCase())
  if (item) item.pushNotificationsActive = value
}
export const pushNotificationHandlers = [
  http.get('/mailboxes/{mailbox}/push-notifications', ({ params, request, response }) => {
    const record = scope(params.mailbox, request, false)
    if (record instanceof Response) return response.untyped(record)
    return response(200).json(
      { data: pushSettingsView(record.push) },
      { headers: { ETag: pushEtag(record.push) } },
    )
  }),
  http.put('/mailboxes/{mailbox}/push-notifications', async ({ params, request, response }) => {
    const record = scope(params.mailbox, request, true)
    if (record instanceof Response) return response.untyped(record)
    const stale = preconditionFailed(request, pushEtag(record.push))
    if (stale) return response.untyped(stale)
    const body = (await request.json()) as Writable<PushNotificationSettingsReplacement>
    const errors: Violations = {}
    for (const key of ['token', 'userKey'] as const) {
      if (body[key] === undefined && !record.push?.[key])
        addViolation(errors, key, 'secretRequired')
      else if (body[key] !== undefined && !/^[A-Za-z0-9]{30}$/.test(body[key]))
        addViolation(errors, key, 'invalidFormat', { format: 'pushoverCredential' })
    }
    for (const [key, limit] of [
      ['title', 250],
      ['text', 1024],
      ['senderPattern', 1024],
    ] as const)
      if ((body[key]?.length ?? 0) > limit) addViolation(errors, key, 'tooLong', { limit })
    if ((body.senders?.length ?? 0) > 100) addViolation(errors, 'senders', 'tooMany', { max: 100 })
    for (const [index, value] of (body.senders ?? []).entries())
      if (value.length > 255) addViolation(errors, `senders.${index}`, 'tooLong', { limit: 255 })
    if (body.sound !== undefined && !/^[A-Za-z0-9_-]{1,20}$/.test(body.sound))
      addViolation(errors, 'sound', 'invalidFormat')
    if (body.senderPattern) {
      const pattern = body.senderPattern
      const end = pattern.lastIndexOf(pattern[0]!)
      try {
        if (end <= 0) throw new Error('No delimiter')
        new RegExp(pattern.slice(1, end), pattern.slice(end + 1).replace(/[^imsu]/g, ''))
      } catch {
        addViolation(errors, 'senderPattern', 'invalidRegex')
      }
    }
    if (Object.keys(errors).length) return response.untyped(validationFailed(errors))
    record.push = mockPushSettings({
      ...body,
      token: body.token ?? record.push?.token ?? '',
      userKey: body.userKey ?? record.push?.userKey ?? '',
      title: body.title ?? '',
      text: body.text ?? '',
      senders: body.senders ?? [],
      senderPattern: body.senderPattern ?? '',
      sound: body.sound ?? 'pushover',
      active: body.active ?? true,
      evaluatePriority: body.evaluatePriority ?? false,
      onlyHighPriority: body.onlyHighPriority ?? false,
      version: (record.push?.version ?? 0) + 1,
    })
    active(params.mailbox, record.push.active)
    return response(200).json(
      { data: pushSettingsView(record.push) },
      { headers: { ETag: pushEtag(record.push) } },
    )
  }),
  http.delete('/mailboxes/{mailbox}/push-notifications', ({ params, request, response }) => {
    const record = scope(params.mailbox, request, true)
    if (record instanceof Response) return response.untyped(record)
    const stale = preconditionFailed(request, pushEtag(record.push))
    if (stale) return response.untyped(stale)
    record.push = null
    active(params.mailbox, false)
    return response(204).empty()
  }),
  http.post(
    '/mailboxes/{mailbox}/push-notifications/verification',
    ({ params, request, response }) => {
      const record = scope(params.mailbox, request, true)
      if (record instanceof Response) return response.untyped(record)
      if (!record.push?.token || !record.push.userKey)
        return response.untyped(problem(409, 'push-notifications-not-configured'))
      const unavailable = outage(scenario(), 'pushover')
      if (unavailable) return response.untyped(unavailable)
      return response(200).json({ data: scenario().selfService.pushVerification })
    },
  ),
]
