// Mock API control for end-to-end tests (research R22, R24): each test gets its own scenario on
// the Node mock server, selected by the `mock-scenario` cookie that all of the test's tabs share.
import type { BrowserContext } from '@playwright/test'

import type { Violation } from '../../mocks/contract/validator'
import type { RecordedRequest, ScenarioOverrides, ScenarioPatch } from '../../mocks/scenarios'
import type {
  ChangesElsewhere,
  DeletionsElsewhere,
  DomainFailure,
  MockDomain,
  MockDomainTemplate,
  MockFooter,
} from '../../mocks/scenarios/state'
import type { AliasCapabilities, PermissionFlags } from '@/api'

export const MOCK_URL = `http://127.0.0.1:${process.env.MOCK_PORT ?? 4010}`

export interface MockApi {
  /** Creates an isolated scenario and selects it for this test's browser context. */
  use(name: string, overrides?: ScenarioOverrides): Promise<string>
  /** Changes the current scenario at runtime (flags, accounts, `expireSession`). */
  patch(changes: ScenarioPatch): Promise<void>
  /** Requests the current scenario received, with secrets redacted. */
  requests(): Promise<RecordedRequest[]>
  /** Contract violations of every scenario this test used. */
  violations(): Promise<Violation[]>
  readonly id: string | null
  /**
   * UI 002 (research D28): changes behind the app's back, standing in for another administrator
   * or the classic interface. Every stored change also changes the object's version tag.
   */
  mutateDomain(name: string, changes: Partial<MockDomain>): Promise<void>
  removeDomain(name: string): Promise<void>
  addMailbox(domain: string): Promise<void>
  mutateTemplate(id: number, changes: Partial<MockDomainTemplate>): Promise<void>
  removeTemplate(id: number): Promise<void>
  mutateFooter(name: string, changes: Partial<MockFooter>): Promise<void>
  setCapabilities(changes: ScenarioPatch['capabilities']): Promise<void>
  /** The next call of an operation (for one domain, when given) answers with this problem. */
  failNext(
    operationId: string,
    failure: Omit<DomainFailure, 'operations' | 'times'>,
    options?: { domain?: string; times?: number },
  ): Promise<void>
  /** Delays every answer of an operation (0 removes the delay). */
  delay(operationId: string, ms: number): Promise<void>
  /**
   * UI 004 (research R21): stored values changed behind the app's back, for example
   * `{ alias: { 'sales@example.org': { destinations: ['bob@example.org'] } } }`. Aliases are named by
   * ID or address, alias domains by name, resources by address and sender settings by mailbox.
   */
  changeElsewhere(changes: ChangesElsewhere): Promise<void>
  /** UI 004: objects deleted behind the app's back. */
  deleteElsewhere(deletions: DeletionsElsewhere): Promise<void>
  /** UI 004: an account's permission flags change (by username). */
  setFlags(username: string, flags: Partial<PermissionFlags>): Promise<void>
  /** UI 004: the capabilities of `getAliasesCapabilities` change. */
  setCapabilities004(changes: Partial<AliasCapabilities>): Promise<void>
  /** UI 004: mailcow's shared store goes down (alias domain operations answer 503) or comes back. */
  setSharedStoreDown(down: boolean): Promise<void>
}

async function control<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${MOCK_URL}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`mock server ${method} ${path}: ${response.status} ${await response.text()}`)
  }
  return (await response.json()) as T
}

export function createMockApi(context: BrowserContext, appUrl: string): MockApi {
  const used: string[] = []
  let current: string | null = null
  return {
    get id() {
      return current
    },
    async use(name, overrides = {}) {
      const { id } = await control<{ id: string }>('POST', '/__mock/scenarios', { name, overrides })
      current = id
      used.push(id)
      // Path `/`: a cookie set from the app URL would get the path `/ng/` and never reach
      // `/api/v2`.
      await context.addCookies([
        { name: 'mock-scenario', value: id, domain: new URL(appUrl).hostname, path: '/' },
      ])
      return id
    },
    async patch(changes) {
      if (!current) throw new Error('mockApi.patch before mockApi.use')
      await control('PATCH', `/__mock/scenarios/${current}`, changes)
    },
    async requests() {
      if (!current) return []
      const { requests } = await control<{ requests: RecordedRequest[] }>(
        'GET',
        `/__mock/scenarios/${current}/requests`,
      )
      return requests
    },
    mutateDomain(name, changes) {
      return this.patch({ domains: { set: { [name]: changes } } })
    },
    removeDomain(name) {
      return this.patch({ domains: { remove: [name] } })
    },
    addMailbox(domain) {
      return this.patch({ domains: { addMailbox: [domain] } })
    },
    mutateTemplate(id, changes) {
      return this.patch({ templates: { set: { [String(id)]: changes } } })
    },
    removeTemplate(id) {
      return this.patch({ templates: { remove: [id] } })
    },
    mutateFooter(name, changes) {
      return this.patch({ footers: { set: { [name]: changes } } })
    },
    setCapabilities(changes) {
      return this.patch({ capabilities: changes })
    },
    failNext(operationId, failure, options = {}) {
      const times = options.times ?? 1
      if (options.domain) {
        return this.patch({
          domainFailures: { [options.domain]: { ...failure, operations: [operationId], times } },
        })
      }
      return this.patch({ failures: { [operationId]: { ...failure, times } } })
    },
    delay(operationId, ms) {
      return this.patch({ delays: { [operationId]: ms } })
    },
    changeElsewhere(changes) {
      return this.patch({ changeElsewhere: changes })
    },
    deleteElsewhere(deletions) {
      return this.patch({ deleteElsewhere: deletions })
    },
    setFlags(username, flags) {
      return this.patch({ flags: { [username]: flags } })
    },
    setCapabilities004(changes) {
      return this.patch({ capabilities004: changes })
    },
    setSharedStoreDown(down) {
      return this.patch({ sharedStoreDown: down })
    },
    async violations() {
      const all: Violation[] = []
      for (const id of used) {
        const { violations } = await control<{ violations: Violation[] }>(
          'GET',
          `/__mock/scenarios/${id}/violations`,
        )
        all.push(...violations)
      }
      return all
    },
  }
}
