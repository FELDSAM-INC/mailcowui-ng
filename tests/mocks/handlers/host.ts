// Host and installation handlers (UI 011 T014, T045, T126): the monitoring capabilities here; the
// host overview, mail storage, installation version, update status and public addresses follow in
// their stories.
import { http } from './context'
import { operationGate } from './operations-context'

export const hostHandlers = [
  http.get('/capabilities/monitoring', async ({ response }) => {
    const gate = await operationGate('getMonitoringCapabilities')
    if (gate.stop) return response.untyped(gate.stop)
    return gate.finish(response(200).json({ data: gate.state.operations.capabilities }))
  }),
]
