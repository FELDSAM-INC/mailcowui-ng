import type { QuotaNotificationSettings, QuotaNotificationRecipients } from '@/api'
import { http, problem, scenario } from './context'
import {
  requireAdmin,
  requireManager,
  findInScope,
  addViolation,
  validationFailed,
  type Violations,
} from './domain-rules'

export const quotaDefaults = {
  sender: 'quota-warning@localhost',
  subject: 'Quota warning',
  htmlTemplate: '<h1>Quota warning</h1><p>{{username}}: {{percent}}%</p>',
}
export function quotaView(stored: QuotaNotificationSettings): QuotaNotificationSettings {
  return {
    ...stored,
    sender: stored.sender || quotaDefaults.sender,
    subject: stored.subject || quotaDefaults.subject,
    htmlTemplate: stored.htmlTemplate || quotaDefaults.htmlTemplate,
    senderIsDefault: !stored.sender,
    subjectIsDefault: !stored.subject,
    htmlTemplateIsDefault: !stored.htmlTemplate,
  }
}
function copies(domain: string): QuotaNotificationRecipients {
  return (
    scenario().settings.quotaCopies[domain] ?? {
      domain,
      recipients: [],
      active: false,
      etag: '"copies-empty"',
    }
  )
}
export const settingsQuotaHandlers = [
  http.get('/settings/quota-notification', ({ response }) => {
    const account = requireAdmin(scenario())
    if (account instanceof Response) return response.untyped(account)
    const data = quotaView(scenario().settings.quota)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
  http.patch('/settings/quota-notification', async ({ request, response }) => {
    const state = scenario(),
      account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    if (state.settings.capabilities.demoMode) return response.untyped(problem(403, 'demo-mode'))
    if (request.headers.get('if-match') !== state.settings.quota.etag)
      return response.untyped(problem(412, null))
    const body = await request.json(),
      errors: Violations = {}
    if (body.sender && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.sender))
      addViolation(errors, 'sender', 'invalidFormat', { format: 'email' })
    if (body.subject && /[\u0000-\u001f\u007f]/.test(body.subject))
      addViolation(errors, 'subject', 'invalidFormat', { format: 'singleLine' })
    if (body.subject && [...body.subject].length > 255)
      addViolation(errors, 'subject', 'tooLong', { max: 255 })
    if (
      body.htmlTemplate &&
      Buffer.byteLength(body.htmlTemplate) > state.settings.capabilities.limits.templateMaxBytes
    )
      addViolation(errors, 'htmlTemplate', 'tooLong', {
        max: state.settings.capabilities.limits.templateMaxBytes,
        unit: 'bytes',
      })
    if (Object.keys(errors).length) return response.untyped(validationFailed(errors))
    Object.assign(state.settings.quota, body, { etag: `"quota-${++state.settings.revision}"` })
    const data = quotaView(state.settings.quota)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
  http.get('/domains/{domain}/quota-notification-recipients', ({ params, response }) => {
    const state = scenario(),
      account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const domain = findInScope(state, account, params.domain)
    if (!domain) return response.untyped(problem(404, null))
    const data = copies(domain.name)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
  http.patch(
    '/domains/{domain}/quota-notification-recipients',
    async ({ params, request, response }) => {
      const state = scenario(),
        account = requireManager(state)
      if (account instanceof Response) return response.untyped(account)
      const domain = findInScope(state, account, params.domain)
      if (!domain) return response.untyped(problem(404, null))
      if (state.settings.capabilities.demoMode) return response.untyped(problem(403, 'demo-mode'))
      const before = copies(domain.name)
      if (request.headers.get('if-match') !== before.etag)
        return response.untyped(problem(412, null))
      const body = await request.json(),
        errors: Violations = {}
      const recipients = body.recipients ?? before.recipients
      if (recipients.length > state.settings.capabilities.limits.quotaNotificationRecipientsMax)
        addViolation(errors, 'recipients', 'tooMany', {
          max: state.settings.capabilities.limits.quotaNotificationRecipientsMax,
        })
      recipients.forEach((value, index) => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /[\u0000-\u001f\u007f]/.test(value))
          addViolation(errors, `recipients.${index}`, 'invalidFormat', { format: 'email' })
        if (value.length > 255) addViolation(errors, `recipients.${index}`, 'tooLong', { max: 255 })
      })
      if (Object.keys(errors).length) return response.untyped(validationFailed(errors))
      const seen = new Set<string>()
      const unique = recipients.filter((value) => {
        const key = value.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      const data = {
        ...before,
        recipients: unique,
        active: unique.length > 0 && (body.active ?? before.active),
        etag: `"copies-${++state.settings.revision}"`,
      }
      state.settings.quotaCopies[domain.name] = data
      return response(200).json({ data }, { headers: { ETag: data.etag } })
    },
  ),
]
