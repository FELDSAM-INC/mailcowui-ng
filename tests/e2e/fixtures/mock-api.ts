// Mock API control for end-to-end tests (research R22, R24): each test gets its own scenario on
// the Node mock server, selected by the `mock-scenario` cookie that all of the test's tabs share.
import type { BrowserContext } from '@playwright/test'

import type { Violation } from '../../mocks/contract/validator'
import type { RecordedRequest, ScenarioOverrides, ScenarioPatch } from '../../mocks/scenarios'

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
      await context.addCookies([{ name: 'mock-scenario', value: id, url: appUrl }])
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
