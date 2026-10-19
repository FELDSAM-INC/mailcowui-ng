// The connection test calls (research R11): nothing is cached (the composable runs them through a
// mutation with `gcTime: 0`), and the request takes an `AbortSignal` for the watchdog and for
// leaving the page.
import {
  api,
  requireData,
  type RoutingConnectionTestRequest,
  type RoutingConnectionTestResult,
} from '@/api'

export type ConnectionTestKind = 'relayhost' | 'transport'

export async function runConnectionTest(
  kind: ConnectionTestKind,
  id: number,
  body: RoutingConnectionTestRequest,
  signal: AbortSignal,
): Promise<RoutingConnectionTestResult> {
  if (kind === 'relayhost') {
    return requireData(
      await api.POST('/relayhosts/{relayhostId}/connection-test', {
        params: { path: { relayhostId: id } },
        body,
        signal,
      }),
    ).data
  }
  return requireData(
    await api.POST('/transports/{transportId}/connection-test', {
      params: { path: { transportId: id } },
      body,
      signal,
    }),
  ).data
}
