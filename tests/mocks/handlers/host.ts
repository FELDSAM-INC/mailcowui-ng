// Host and installation handlers (UI 011 T014, T045, T126): the monitoring capabilities, the host
// overview (figures change on every request, `currentTime` from the scenario's host clock,
// `collectedAt` lagging by the scenario's lag), the mail storage usage, the installed version, the
// update status and the public addresses. Every operation honours the scenario's injections.
import { hostOverview, storageUsage, updateStatus } from '../factories/host'
import { collectedAt, hostNow } from '../scenarios/operations/state'
import { http, problem } from './context'
import { operationGate } from './operations-context'

export const hostHandlers = [
  http.get('/capabilities/monitoring', async ({ response }) => {
    const gate = await operationGate('getMonitoringCapabilities')
    if (gate.stop) return response.untyped(gate.stop)
    return gate.finish(response(200).json({ data: gate.state.operations.capabilities }))
  }),

  http.get('/host', async ({ response }) => {
    const gate = await operationGate('getHostOverview')
    if (gate.stop) return response.untyped(gate.stop)
    const data = gate.state.operations.dashboard
    if (!data.host)
      return response.untyped(problem(503, 'temporary-failure', {}, { 'Retry-After': '30' }))
    const sequence = data.overviewRequests
    data.overviewRequests += 1
    return gate.finish(
      response(200).json({
        data: hostOverview(
          data.host,
          data.version,
          sequence,
          hostNow(gate.state),
          collectedAt(gate.state, 'host'),
        ),
      }),
    )
  }),

  http.get('/host/mail-storage', async ({ response }) => {
    const gate = await operationGate('getMailStorageUsage')
    if (gate.stop) return response.untyped(gate.stop)
    const data = gate.state.operations.dashboard
    return gate.finish(
      response(200).json({
        data: storageUsage(data.storage, collectedAt(gate.state, 'mailStorage')),
      }),
    )
  }),

  http.get('/host/public-addresses', async ({ response }) => {
    const gate = await operationGate('getPublicAddresses')
    if (gate.stop) return response.untyped(gate.stop)
    if (!gate.state.operations.capabilities.ipCheckEnabled) {
      return response.untyped(problem(409, 'ip-check-disabled'))
    }
    const { ipv4, ipv6 } = gate.state.operations.updates.addresses
    return gate.finish(
      response(200).json({
        data: { ipv4, ipv6, checkedAt: new Date(hostNow(gate.state)).toISOString() },
      }),
    )
  }),

  http.get('/installation', async ({ response }) => {
    const gate = await operationGate('getInstallationVersion')
    if (gate.stop) return response.untyped(gate.stop)
    return gate.finish(response(200).json({ data: gate.state.operations.dashboard.version }))
  }),

  http.get('/installation/update-status', async ({ response }) => {
    const gate = await operationGate('getUpdateStatus')
    if (gate.stop) return response.untyped(gate.stop)
    const { status } = gate.state.operations.updates
    return gate.finish(
      response(200).json({
        data: updateStatus(status, new Date(hostNow(gate.state)).toISOString()),
      }),
    )
  }),
]
