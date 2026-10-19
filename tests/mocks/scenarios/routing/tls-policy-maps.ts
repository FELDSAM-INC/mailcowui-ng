// TLS policy map seeds (UI 009 T089): one map per policy, one of them without parameters.
import { mockTlsPolicyMap } from '../../factories/tls-policy-map'
import type { ScenarioState } from '../state'
import { TLS_POLICIES } from './state'

export function seedTlsPolicyMaps(state: ScenarioState): void {
  TLS_POLICIES.forEach((policy, index) => {
    state.routing.tlsPolicyMaps.push(
      mockTlsPolicyMap({
        id: index + 1,
        destination: `${policy}.example`,
        policy,
        parameters: index === 0 ? '' : 'protocols=!SSLv2 ciphers=medium',
        active: index !== 7,
      }),
    )
  })
}
