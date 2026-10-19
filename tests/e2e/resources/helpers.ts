// Helpers of the resource end-to-end tests (UI 004 US7).
import type { Page } from '@playwright/test'

export type Requests = {
  requests(): Promise<
    { operationId: string | null; body?: unknown; headers: Record<string, string> }[]
  >
}

export const requestsOf = async (mockApi: Requests, operationId: string) =>
  (await mockApi.requests()).filter((r) => r.operationId === operationId)

export const entry = (page: Page, address: string) => page.locator(`[data-entry="${address}"]`)

export const trigger = (page: Page, address: string) =>
  entry(page, address).getByRole('button', { name: /^Actions for/ })

export const section = (page: Page) => page.locator('#section-resource')

export const saveButton = (page: Page) =>
  section(page).getByRole('button', { name: 'Save changes' })
