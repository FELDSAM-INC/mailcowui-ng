import type { Page } from '@playwright/test'

import { expect } from '../fixtures/test'

/** Open the mobile action menu only when the requested action is not already visible. */
export async function itemAction(page: Page, action: string) {
  const control = page.locator(`[data-item-action="${action}"]`)
  if (!(await control.isVisible())) await page.locator('[data-item-actions-menu]').click()
  await control.click()
}

export async function openItem(page: Page, id: number) {
  await page.goto(`quarantine/${id}`)
  await expect(page.locator(`[data-item="${id}"]`)).toBeVisible()
}
