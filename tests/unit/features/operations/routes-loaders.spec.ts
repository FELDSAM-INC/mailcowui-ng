// UI 011 (data-model §5, research R22): every operations page loads lazily together with its
// strings, and a container's address passes the container's name to the dashboard as `expand`.
import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'

import { operationsRoutes } from '@/features/operations'
import { i18n } from '@/i18n'

const route = (name: string) => operationsRoutes.find((item) => item.name === name)!

describe('operations route loaders', () => {
  it.each([
    'operations-dashboard',
    'operations-container',
    'operations-rspamd',
    'operations-log',
    'operations-mail-queue',
    'operations-mail-queue-message',
    'operations-fail2ban',
  ])('%s loads its page and the operations strings', { timeout: 30_000 }, async (name) => {
    const record = route(name) as RouteRecordRaw & { component: () => Promise<unknown> }
    const loaded = (await record.component()) as { default: unknown }
    expect(loaded.default).toBeTruthy()
    expect(i18n.global.te('operations.live.pause', 'en-gb')).toBe(true)
  })

  it('passes the container name of the address as the card to expand', () => {
    const props = route('operations-container').props as (
      location: RouteLocationNormalized,
    ) => Record<string, unknown>
    expect(props({ params: { containerName: 'sogo-mailcow' } } as never)).toEqual({
      expand: 'sogo-mailcow',
    })
  })

  it('keeps the redirects of the section roots', () => {
    expect(route('operations').redirect).toEqual({ name: 'operations-dashboard' })
    expect(route('operations-logs').redirect).toEqual({
      name: 'operations-log',
      params: { logType: 'postfix' },
    })
  })
})
