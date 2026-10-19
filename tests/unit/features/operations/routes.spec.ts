// UI 011 (data-model §5, FR-002, T024): the operations addresses, the redirects of the section
// roots, and the container address helper that other screens use.
import { describe, expect, it } from 'vitest'

import { containerRoute } from '@/features/operations'

import { createTestRouter } from '../../support/router'

describe('operations routes', () => {
  it('redirects /operations to the dashboard and /operations/logs to the first log', async () => {
    const router = createTestRouter()
    await router.push('/operations')
    expect(router.currentRoute.value.name).toBe('operations-dashboard')
    await router.push('/operations/logs')
    expect(router.currentRoute.value.fullPath).toBe('/operations/logs/postfix')
  })

  it('opens a container, a log, Rspamd and a queued message at their own addresses', () => {
    const router = createTestRouter()
    const resolve = (path: string) => router.resolve(path)
    expect(resolve('/operations/containers/sogo-mailcow').name).toBe('operations-container')
    expect(resolve('/operations/containers/Bad Name').name).toBe('not-found')
    expect(resolve('/operations/logs/rspamd').name).toBe('operations-rspamd')
    expect(resolve('/operations/logs/dovecot').name).toBe('operations-log')
    expect(resolve('/operations/mail-queue/messages/4F2A1B').name).toBe(
      'operations-mail-queue-message',
    )
    expect(resolve('/operations/mail-queue/messages/xyz').name).toBe('not-found')
    expect(resolve('/operations/fail2ban').name).toBe('operations-fail2ban')
  })

  it('builds a container address only for names that match the contract pattern', () => {
    expect(containerRoute('sogo-mailcow')).toEqual({
      name: 'operations-container',
      params: { containerName: 'sogo-mailcow' },
    })
    expect(containerRoute('postfix_tlspol.mailcow')).not.toBeNull()
    expect(containerRoute('-bad')).toBeNull()
    expect(containerRoute('Upper')).toBeNull()
    expect(containerRoute('a'.repeat(64))).toBeNull()
  })
})
