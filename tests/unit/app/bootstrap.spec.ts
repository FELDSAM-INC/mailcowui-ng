// The start sequence (research R11, FR-003, FR-030, spec edge case "API not ready").
import { flushPromises } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearCsrfToken, createQueryClient, queryKeys } from '@/api'
import { bootstrapStatus, runBootstrap, whenBootstrapped } from '@/app/bootstrap'
import { usePreferencesStore } from '@/app/preferences/store'
import ServiceUnavailablePage from '@/app/states/ServiceUnavailablePage.vue'
import { i18n } from '@/i18n'

import { mockState, server, useScenario } from '../../mocks/node'
import { mountWithApp } from '../support/mount'

const ops = () => mockState().requests.map((r) => r.operationId)

beforeEach(() => {
  clearCsrfToken()
})

afterEach(() => {
  clearCsrfToken()
})

describe('bootstrap order', () => {
  it('fetches the token alone, then session and configuration, then the identity', async () => {
    useScenario('admin-active')
    const queryClient = createQueryClient({ retryDelay: 0 })
    const order: string[] = []
    let inFlight = 0
    let maxParallel = 0
    server.events.on('request:start', ({ request }) => {
      inFlight += 1
      maxParallel = Math.max(maxParallel, inFlight)
      order.push(new URL(request.url).pathname)
    })
    server.events.on('request:end', () => {
      inFlight -= 1
    })
    expect(await runBootstrap({ queryClient })).toBe('ready')
    server.events.removeAllListeners()
    expect(order[0]).toBe('/api/v2/csrf-token')
    expect(order.slice(1, 3).sort()).toEqual(['/api/v2/public-config', '/api/v2/session'])
    expect(order[3]).toBe('/api/v2/me')
    expect(maxParallel).toBe(2)
    expect(ops()).toEqual(['getCsrfToken', expect.any(String), expect.any(String), 'getIdentity'])
    expect(queryClient.getQueryData(queryKeys.identity())).toBeDefined()
    expect(bootstrapStatus.value).toBe('ready')
    await expect(whenBootstrapped()).resolves.toBeUndefined()
  })

  it('does not fetch the identity for an anonymous or pending session', async () => {
    useScenario('anonymous-default')
    expect(await runBootstrap({ queryClient: createQueryClient({ retryDelay: 0 }) })).toBe('ready')
    expect(ops()).not.toContain('getIdentity')
  })

  it('fetches the identity for a restricted session', async () => {
    useScenario('anonymous-default', { signedInAs: 'bob@example.org' })
    await runBootstrap({ queryClient: createQueryClient({ retryDelay: 0 }) })
    expect(ops()).toContain('getIdentity')
  })

  it('applies the languages, the remembered device settings and the profile', async () => {
    useScenario('anonymous-default', {
      signedInAs: 'admin',
      accounts: { admin: { preferences: { language: 'cs-cz', theme: 'dark', etag: '"p2"' } } },
    })
    await runBootstrap({ queryClient: createQueryClient({ retryDelay: 0 }) })
    const preferences = usePreferencesStore()
    expect(preferences.availableLocales).toEqual(['en-gb', 'cs-cz', 'sk-sk'])
    expect(preferences.locale).toBe('cs-cz')
    expect(i18n.global.locale.value).toBe('cs-cz')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})

describe('API not ready', () => {
  it.each([
    ['a network error', () => HttpResponse.error()],
    [
      'an HTML 502 from nginx',
      () =>
        new HttpResponse('<html>502</html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        }),
    ],
    [
      'a 503 without problem details',
      () => new HttpResponse('down', { status: 503, headers: { 'Content-Type': 'text/plain' } }),
    ],
  ])('shows the unavailable page after %s, and its retry recovers', async (_label, failure) => {
    useScenario('admin-active')
    server.use(http.get('*/api/v2/csrf-token', failure))
    const queryClient = createQueryClient({ retryDelay: 0 })
    expect(await runBootstrap({ queryClient })).toBe('unavailable')
    expect(bootstrapStatus.value).toBe('unavailable')

    const wrapper = mountWithApp(ServiceUnavailablePage)
    expect(wrapper.find('h1').text()).toBe('Service temporarily unavailable')
    server.resetHandlers()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    await vi.waitFor(() => expect(bootstrapStatus.value).toBe('ready'))
  })

  it('treats a documented 500 of the session as not ready', async () => {
    useScenario('bootstrap-500')
    expect(await runBootstrap({ queryClient: createQueryClient({ retryDelay: 0 }) })).toBe(
      'unavailable',
    )
  })

  it('keeps going with the defaults when only the configuration fails (FR-003)', async () => {
    useScenario('config-unavailable')
    const queryClient = createQueryClient({ retryDelay: 0 })
    expect(await runBootstrap({ queryClient })).toBe('ready')
    expect(queryClient.getQueryData(queryKeys.publicConfig())).toBeUndefined()
    expect(usePreferencesStore().availableLocales).toEqual(['en-gb', 'cs-cz', 'sk-sk'])
  })
})
