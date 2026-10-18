// Client checks of the allowed networks (FR-065, data-model §6): empty entries are dropped, at
// most 100 entries, each at most 49 characters and an IPv4 or IPv6 address or prefix. Errors use
// the API's field paths (`allowedNetworks.2` is the third entry), so server errors land on the
// same entries. The server validates again.
import { ALLOWED_NETWORKS_MAX_ITEMS, NETWORK_MAX_LENGTH } from '@/shared/validation/limits'
import { isIpNetwork } from '@/shared/validation/ip-network'

export function validateNetworks(entries: readonly string[]): {
  networks: string[]
  errors: Record<string, string[]>
} {
  const networks = entries.map((entry) => entry.trim()).filter((entry) => entry.length > 0)
  const errors: Record<string, string[]> = {}
  if (networks.length > ALLOWED_NETWORKS_MAX_ITEMS) errors.allowedNetworks = ['validation.tooMany']
  networks.forEach((network, index) => {
    if (network.length > NETWORK_MAX_LENGTH || !isIpNetwork(network)) {
      errors[`allowedNetworks.${index}`] = ['validation.format.ipNetwork']
    }
  })
  return { networks, errors }
}
