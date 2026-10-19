// Forwarding host seeds (UI 009 T102): an address added from a name, a network, an expanded IPv6
// address from the classic interface and an entry with an empty source, plus the DNS table.
import { mockForwardingHost } from '../../factories/forwarding-host'
import type { ScenarioState } from '../state'

export function seedForwardingHosts(state: ScenarioState): void {
  state.routing.forwardingHosts.push(
    mockForwardingHost({ address: '198.51.100.7', source: 'forwarder.example' }),
    mockForwardingHost({ address: '192.0.2.0/24', source: '192.0.2.0/24', spamFilter: false }),
    mockForwardingHost({
      address: '2001:0db8:0000:0000:0000:0000:0000:0001',
      source: '2001:0db8:0000:0000:0000:0000:0000:0001',
    }),
    mockForwardingHost({ address: '203.0.113.9', source: '' }),
  )
  state.routing.dns = {
    'forwarder.example': ['198.51.100.7', '198.51.100.8'],
    'nothing.example': 'none',
    'dns-down.example': 'temporaryFailure',
  }
}
