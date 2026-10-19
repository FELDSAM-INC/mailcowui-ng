// Helpers of the UI 011 dashboard end-to-end tests: opening the dashboard once its sections show,
// a container's card, and expanding it.
import { expect, type Locator, type Page } from '@playwright/test'

import type { MockApi } from '../fixtures/mock-api'

export async function openDashboard(page: Page, path = 'operations/dashboard'): Promise<void> {
  await page.goto(path)
  // The first visit loads the page chunk and the language files; generous on a loaded machine.
  await expect(page.getByRole('heading', { level: 1, name: 'System & Containers' })).toBeVisible({
    timeout: 15_000,
  })
}

/** Waits until the host figures and the containers are shown. */
export async function dashboardReady(page: Page): Promise<void> {
  await expect(page.locator('[data-hostname]')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('[data-containers] li').first()).toBeVisible()
}

export function card(page: Page, name: string): Locator {
  return page.locator(`[data-container="${name}"]`)
}

export async function expand(page: Page, name: string): Promise<Locator> {
  const target = card(page, name)
  const button = target.locator('[data-expand]')
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click()
  await expect(target.locator('[data-container-details]')).toBeVisible()
  return target
}

export async function requestsOf(mockApi: MockApi, operationId: string) {
  return (await mockApi.requests()).filter((request) => request.operationId === operationId)
}
