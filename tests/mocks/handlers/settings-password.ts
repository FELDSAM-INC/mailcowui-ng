import type { PasswordResetNotification } from '@/api'
import { http, problem, requireAccount, scenario } from './context'

export const defaultResetTemplates = {
  textTemplate:
    'Hello {{username}},\n\nReset your password: {{link}}\nThe link is valid for {{token_lifetime}} minutes.\n{{hostname}}',
  htmlTemplate:
    '<h1>Password reset</h1><p>Hello {{username}},</p><p><a href="{{link}}">Reset your password</a></p><p>The link is valid for {{token_lifetime}} minutes.</p><p>{{hostname}}</p>',
}
export function resetNotificationView(
  stored: PasswordResetNotification,
): PasswordResetNotification {
  const templatesAreDefault = stored.textTemplate === '' && stored.htmlTemplate === ''
  return {
    ...stored,
    ...(templatesAreDefault ? defaultResetTemplates : {}),
    templatesAreDefault,
    passwordResetAvailable: stored.sender !== '' && stored.subject !== '',
  }
}
function requireAdmin() {
  const account = requireAccount(scenario())
  return account instanceof Response
    ? account
    : account.role !== 'admin'
      ? problem(403, 'forbidden')
      : null
}
export const settingsPasswordHandlers = [
  http.get('/settings/password-reset-notification', ({ response }) => {
    const denied = requireAdmin()
    if (denied) return response.untyped(denied)
    const data = resetNotificationView(scenario().settings.passwordReset)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
  http.patch('/settings/password-reset-notification', async ({ request, response }) => {
    const denied = requireAdmin()
    if (denied) return response.untyped(denied)
    const state = scenario()
    if (state.settings.capabilities.demoMode) return response.untyped(problem(403, 'demo-mode'))
    const stored = state.settings.passwordReset
    if (request.headers.get('if-match') !== stored.etag) return response.untyped(problem(412, null))
    const body = await request.json()
    const errors: Record<
      string,
      { code: string; message: string; params?: Record<string, unknown> }[]
    > = {}
    if (
      body.sender &&
      (!/^[^\s@]+@[^\s@]+$/.test(body.sender) || /[\u0000-\u001f\u007f]/.test(body.sender))
    )
      errors.sender = [
        { code: 'invalidFormat', message: 'Invalid email', params: { format: 'email' } },
      ]
    if (body.subject && /[\u0000-\u001f\u007f]/.test(body.subject))
      errors.subject = [
        { code: 'invalidFormat', message: 'Use a single line', params: { format: 'singleLine' } },
      ]
    else if (body.subject && [...body.subject].length > 255)
      errors.subject = [{ code: 'tooLong', message: 'Subject too long', params: { max: 255 } }]
    for (const field of ['textTemplate', 'htmlTemplate'] as const)
      if (
        body[field] !== undefined &&
        Buffer.byteLength(body[field], 'utf8') > state.settings.capabilities.limits.templateMaxBytes
      )
        errors[field] = [
          {
            code: 'tooLong',
            message: 'Template too long',
            params: { max: state.settings.capabilities.limits.templateMaxBytes, unit: 'bytes' },
          },
        ]
    if (Object.keys(errors).length)
      return response.untyped(problem(422, 'validation-failed', { errors }))
    Object.assign(stored, body, { etag: `"password-reset-${++state.settings.revision}"` })
    const data = resetNotificationView(stored)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
]
