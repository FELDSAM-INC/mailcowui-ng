import { http } from './context'
import {
  listManaged,
  readManaged,
  createManaged,
  updateManaged,
  deleteManaged,
  suspendManaged,
  bulkManaged,
} from './administrator-rules'
export const domainAdminHandlers = [
  http.get('/domain-admins', ({ request, response }) =>
    response.untyped(listManaged('domainAdmin', request)),
  ),
  http.post('/domain-admins', async ({ request, response }) =>
    response.untyped(await createManaged('domainAdmin', request)),
  ),
  http.post('/domain-admins/bulk-actions', async ({ request, response }) =>
    response.untyped(await bulkManaged('domainAdmin', request)),
  ),
  http.get('/domain-admins/{username}', ({ params, request, response }) =>
    response.untyped(readManaged('domainAdmin', params.username, request)),
  ),
  http.patch('/domain-admins/{username}', async ({ params, request, response }) =>
    response.untyped(await updateManaged('domainAdmin', params.username, request)),
  ),
  http.delete('/domain-admins/{username}', ({ params, request, response }) =>
    response.untyped(deleteManaged('domainAdmin', params.username, request)),
  ),
  http.post('/domain-admins/{username}/second-factor-suspension', ({ params, request, response }) =>
    response.untyped(suspendManaged('domainAdmin', params.username, request)),
  ),
]
