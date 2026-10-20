import { http, scenario } from './context'
import { requireAdmin } from './domain-rules'
import {
  listManaged,
  readManaged,
  createManaged,
  updateManaged,
  deleteManaged,
  suspendManaged,
  bulkManaged,
} from './administrator-rules'
export const adminHandlers = [
  http.get('/capabilities/accounts', ({ response }) => {
    const state = scenario()
    const actor = requireAdmin(state)
    return actor instanceof Response
      ? response.untyped(actor)
      : response(200).json({ data: state.accountDefaults })
  }),
  http.get('/admins', ({ request, response }) => response.untyped(listManaged('admin', request))),
  http.post('/admins', async ({ request, response }) =>
    response.untyped(await createManaged('admin', request)),
  ),
  http.post('/admins/bulk-actions', async ({ request, response }) =>
    response.untyped(await bulkManaged('admin', request)),
  ),
  http.get('/admins/{username}', ({ params, request, response }) =>
    response.untyped(readManaged('admin', params.username, request)),
  ),
  http.patch('/admins/{username}', async ({ params, request, response }) =>
    response.untyped(await updateManaged('admin', params.username, request)),
  ),
  http.delete('/admins/{username}', ({ params, request, response }) =>
    response.untyped(deleteManaged('admin', params.username, request)),
  ),
  http.post('/admins/{username}/second-factor-suspension', ({ params, request, response }) =>
    response.untyped(suspendManaged('admin', params.username, request)),
  ),
]
