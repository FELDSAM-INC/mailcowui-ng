import type { RspamdUiPasswordRequest, Writable } from '@/api'
import { http, problem, requireAccount, scenario } from './context'

export const settingsRspamdHandlers = [
  http.put('/settings/rspamd-ui-password', async ({ request, response }) => {
    const account = requireAccount(scenario())
    if (account instanceof Response) return response.untyped(account)
    if (account.role !== 'admin') return response.untyped(problem(403, 'forbidden'))
    // openapi-msw preserves the schema's write-only marker; the validated wire body is writable.
    const body = (await request.json()) as unknown as Writable<RspamdUiPasswordRequest>
    if (/[\u0000-\u001f\u007f]/.test(body.password)) {
      return response.untyped(
        problem(422, 'validation-failed', {
          errors: {
            password: [
              {
                code: 'invalidFormat',
                message: 'Control characters are not allowed.',
                params: { format: 'singleLine' },
              },
            ],
          },
        }),
      )
    }
    // The mock never stores the password (even in a hash); 204 confirms the container action.
    return response(204).empty()
  }),
]
