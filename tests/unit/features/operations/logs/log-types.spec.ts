// UI 011 (FR-030, FR-031, T074; plan "Decisions at implementation" items 5, 10 and 12): the 12 log
// types in legacy's order and groups, each on its contract operation, with legacy's columns.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { findLogType, LOG_TYPES } from '@/features/operations/logs/log-types'

const contract = JSON.parse(readFileSync(join(process.cwd(), 'contract/openapi.json'), 'utf8')) as {
  paths: Record<string, { get?: { operationId: string } }>
  components: {
    schemas: { MonitoringCapabilities: { properties: { logRetention: { required: string[] } } } }
  }
}

const columnKeys = (slug: string) => findLogType(slug)!.columns.map((column) => column.key)

describe('log types', () => {
  it('lists every log operation of the contract once, in legacy order and groups', () => {
    const logPaths = Object.keys(contract.paths).filter((path) => path.startsWith('/logs/'))
    expect(LOG_TYPES.map((type) => type.path).sort()).toEqual(logPaths.sort())
    expect(LOG_TYPES.map((type) => [type.slug, type.group])).toEqual([
      ['postfix', 'inMemory'],
      ['dovecot', 'inMemory'],
      ['sogo', 'inMemory'],
      ['netfilter', 'inMemory'],
      ['autodiscover', 'inMemory'],
      ['watchdog', 'inMemory'],
      ['acme', 'inMemory'],
      ['legacy-api-requests', 'inMemory'],
      ['rate-limits', 'inMemory'],
      ['cron', 'inMemory'],
      ['legacy-ui-activity', 'stored'],
      ['logins', 'stored'],
    ])
  })

  it('names each type with its operation and legacy name', () => {
    for (const type of LOG_TYPES) {
      expect(contract.paths[type.path]?.get?.operationId, type.slug).toBe(type.operationId)
      expect(type.titleKey).toMatch(/^operations\.logs\.types\.[a-z]+$/)
    }
    expect(LOG_TYPES.map((type) => type.titleKey.split('.').at(-1))).toEqual([
      'postfix',
      'dovecot',
      'sogo',
      'netfilter',
      'autodiscover',
      'watchdog',
      'acme',
      'api',
      'ratelimits',
      'crontasks',
      'ui',
      'sasl',
    ])
  })

  it('reads its retention from the capabilities', () => {
    const keys = contract.components.schemas.MonitoringCapabilities.properties.logRetention.required
    for (const type of LOG_TYPES) expect(keys, type.slug).toContain(type.retentionKey)
  })

  it('has legacy columns in legacy order, without data legacy never shows', () => {
    expect(columnKeys('postfix')).toEqual(['time', 'priority', 'message'])
    expect(columnKeys('netfilter')).toEqual(['time', 'priority', 'message'])
    expect(columnKeys('autodiscover')).toEqual(['time', 'userAgent', 'user', 'ip', 'service'])
    expect(columnKeys('watchdog')).toEqual(['time', 'service', 'trend', 'message'])
    expect(columnKeys('acme')).toEqual(['time', 'message'])
    expect(columnKeys('legacy-api-requests')).toEqual(['time', 'uri', 'method', 'ip', 'data'])
    expect(columnKeys('rate-limits')).toEqual([
      'stripe',
      'time',
      'rateLimitName',
      'sender',
      'recipients',
      'user',
      'messageId',
      'headerFrom',
      'subject',
      'hash',
      'scannerQueueId',
      'ip',
      'action',
    ])
    expect(columnKeys('cron')).toEqual(['time', 'task', 'priority', 'message'])
    expect(columnKeys('legacy-ui-activity')).toEqual([
      'time',
      'type',
      'task',
      'user',
      'role',
      'ip',
      'message',
      'call',
    ])
    expect(columnKeys('logins')).toEqual(['username', 'service', 'ip', 'time'])
  })

  it("keeps the classic interface's always hidden call in the details", () => {
    const call = findLogType('legacy-ui-activity')!.columns.find((column) => column.key === 'call')
    expect(call?.detail).toBe(true)
  })

  it('finds a type by its slug only', () => {
    expect(findLogType('postfix')?.operationId).toBe('listPostfixLog')
    expect(findLogType('rspamd')).toBeUndefined()
    expect(findLogType('unknown')).toBeUndefined()
  })
})
