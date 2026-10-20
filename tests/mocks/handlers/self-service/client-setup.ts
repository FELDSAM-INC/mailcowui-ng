import { HttpResponse } from 'msw'
import type { AppleProfileRequest } from '@/api'
import { generatedAppPassword, mockAppPassword } from '../../factories/app-password'
import { applePlist, PROFILE_FILE_NAME } from '../../factories/apple-profile'
import { clientConfiguration } from '../../factories/client-configuration'
import { addressOf } from '../../factories/mailbox'
import { mailboxSelfService } from '../../scenarios/self-service/state'
import { csrfProblem, http, problem, requireAccount, scenario } from '../context'
import { flagRefusal, isoNow, ownMailbox, untypedJson } from './rules'

function scope(request: Request, change: boolean) {
  const state = scenario()
  if (change) {
    const csrf = csrfProblem(state, request)
    if (csrf) return csrf
  }
  const account = requireAccount(state)
  if (account instanceof Response) return account
  const mailbox = ownMailbox(state, account)
  if (mailbox instanceof Response) return mailbox
  if (change) {
    const refusal = flagRefusal(account, 'appPasswds')
    if (refusal) return refusal
  }
  return mailbox
}
function profile(
  address: string,
  variant: AppleProfileRequest['variant'],
  password?: string,
  id?: number,
) {
  if (variant === 'emailAndDav' && !scenario().selfService.groupwareEnabled)
    return problem(403, 'groupware-disabled')
  return new HttpResponse(
    applePlist({ address, variant, ...(password ? { appPassword: password } : {}) }),
    {
      status: password ? 201 : 200,
      headers: {
        'Content-Type': 'application/x-apple-aspen-config',
        'Content-Disposition': `attachment; filename="${PROFILE_FILE_NAME}"`,
        'Cache-Control': 'no-store',
        ...(id ? { Location: `/api/v2/mailboxes/${address}/app-passwords/${id}` } : {}),
      },
    },
  )
}
export const clientSetupHandlers = [
  http.get('/me/mailbox/client-configuration', ({ request, response }) => {
    const mailbox = scope(request, false)
    if (mailbox instanceof Response) return response.untyped(mailbox)
    return response.untyped(
      untypedJson(200, {
        data: clientConfiguration({
          address: addressOf(mailbox),
          displayName: mailbox.displayName,
          groupware: scenario().selfService.groupwareEnabled,
        }),
      }),
    )
  }),
  http.get('/me/mailbox/apple-profile', ({ request, response }) => {
    const mailbox = scope(request, false)
    if (mailbox instanceof Response) return response.untyped(mailbox)
    const variant = (new URL(request.url).searchParams.get('variant') ??
      'emailAndDav') as AppleProfileRequest['variant']
    return response.untyped(profile(addressOf(mailbox), variant))
  }),
  http.post('/me/mailbox/apple-profile', async ({ request, response }) => {
    const mailbox = scope(request, true)
    if (mailbox instanceof Response) return response.untyped(mailbox)
    const body = (await request.json()) as AppleProfileRequest
    const variant = body.variant ?? 'emailAndDav'
    if (variant === 'emailAndDav' && !scenario().selfService.groupwareEnabled)
      return response.untyped(problem(403, 'groupware-disabled'))
    const address = addressOf(mailbox)
    const state = scenario()
    const id = state.selfService.nextAppPasswordId++
    const agent = request.headers.get('user-agent') ?? 'Apple profile'
    const name =
      body.appPasswordName ??
      (/iPad/.test(agent)
        ? 'iPad'
        : /iPhone/.test(agent)
          ? 'iPhone'
          : /Mac/.test(agent)
            ? 'Mac'
            : agent.slice(0, 255))
    mailboxSelfService(state, address).appPasswords.push(
      mockAppPassword({ id, name, createdAt: isoNow(state) }),
    )
    return response.untyped(profile(address, variant, generatedAppPassword(id), id))
  }),
]
