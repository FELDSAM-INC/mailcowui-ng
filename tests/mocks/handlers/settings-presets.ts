import { settingsPresets } from '../factories/settings-preset'
import { http, problem, requireAccount, scenario } from './context'
import { page } from './domain-rules'
export const settingsPresetHandlers = [
  http.get('/presets/{presetKind}', ({ params, request, response }) => {
    const account = requireAccount(scenario())
    if (account instanceof Response) return response.untyped(account)
    if (
      account.role === 'mailboxUser' ||
      (params.presetKind === 'rspamd' && account.role !== 'admin')
    )
      return response.untyped(problem(403, 'forbidden'))
    const url = new URL(request.url),
      q = url.searchParams.get('q')?.toLowerCase()
    const rows = settingsPresets
      .filter(
        (item) =>
          item.kind === params.presetKind &&
          (!q || `${item.headline} ${item.content}`.toLowerCase().includes(q)),
      )
      .sort(
        (a, b) => a.id.localeCompare(b.id) * (url.searchParams.get('order') === 'desc' ? -1 : 1),
      )
    return response(200).json(page(rows, url))
  }),
]
