// Authentication handlers (T026): the anti-forgery token, the session and sign-out. Sign-in steps
// arrive with US1 (T066) and US2.
import { token } from '../factories/ids'
import { anonymousSession } from '../scenarios/state'
import { csrfProblem, http, scenario, sessionBody } from './context'

export const authHandlers = [
  http.get('/csrf-token', ({ response }) => {
    const state = scenario()
    state.session.csrfToken ??= token(48)
    return response(200).json({
      data: { token: state.session.csrfToken, headerName: 'X-CSRF-Token' },
    })
  }),

  http.get('/session', ({ response }) => {
    return response(200).json({ data: sessionBody(scenario()) })
  }),

  http.delete('/session', ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    // Signing out invalidates the session and its token; the next GET /csrf-token starts anew.
    state.session = anonymousSession(state.now())
    return response(204).empty()
  }),
]
