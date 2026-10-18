// Helpers of the UI 012 identity provider end-to-end tests.
import { expect, type Page } from '@playwright/test'

import type { RecordedRequest } from '../../mocks/scenarios'

export const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 0) < 768
export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024

/** Opens the identity provider screen and waits until it has settled. */
export async function openProvider(page: Page, query = ''): Promise<void> {
  await page.goto(`identity-providers/provider${query}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Identity Provider' })).toBeVisible()
  await expect(page.locator('[data-page-loading]')).toHaveCount(0)
}

/** The recorded requests of one operation. */
export async function requestsOf(
  mockApi: { requests(): Promise<RecordedRequest[]> },
  operationId: string,
): Promise<RecordedRequest[]> {
  return (await mockApi.requests()).filter((request) => request.operationId === operationId)
}

/** API 012's operations, which no other role may cause (FR-002, SC-010). */
export const API_012_OPERATIONS = [
  'getIdentityProviderCapabilities',
  'getIdentityProvider',
  'saveIdentityProvider',
  'updateIdentityProvider',
  'deleteIdentityProvider',
  'testIdentityProviderConnection',
  'listOauth2Clients',
  'getOauth2ClientsCapabilities',
]
