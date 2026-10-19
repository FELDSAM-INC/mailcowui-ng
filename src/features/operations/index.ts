// UI feature 011, monitoring and operations (research R3). Other code reaches it only through this
// file: the routes, and the address of a container's card for screens that link to it (for example
// UI 002's Global Address List notice linking to the SOGo container).
import type { RouteLocationRaw } from 'vue-router'

import { CONTAINER_NAME } from './routes'

export { operationsRoutes } from './routes'

/** The address of a container's card on the dashboard; null for a name the API cannot have. */
export function containerRoute(name: string): RouteLocationRaw | null {
  return CONTAINER_NAME.test(name)
    ? { name: 'operations-container', params: { containerName: name } }
    : null
}
