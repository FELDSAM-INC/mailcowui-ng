// Helpers of the alias domain end-to-end tests (UI 004 US4).
import type { Page } from '@playwright/test'

export type Requests = {
  requests(): Promise<
    { operationId: string | null; body?: unknown; headers: Record<string, string> }[]
  >
}

export const requestsOf = async (mockApi: Requests, operationId: string) =>
  (await mockApi.requests()).filter((r) => r.operationId === operationId)

export const entry = (page: Page, name: string) => page.locator(`[data-entry="${name}"]`)

export const trigger = (page: Page, name: string) =>
  entry(page, name).getByRole('button', { name: /^Actions for/ })

export const section = (page: Page) => page.locator('#section-general')

export const saveButton = (page: Page) =>
  section(page).getByRole('button', { name: 'Save changes' })

export const targetPicker = (page: Page, root: Page | ReturnType<Page['locator']> = page) =>
  root.getByRole('combobox', { name: 'Target domain', exact: true })

/** Chooses a target domain in the picker by its name. */
export async function chooseTarget(page: Page, name: string, root = page.locator('body')) {
  const field = root.getByRole('combobox', { name: 'Target domain', exact: true })
  await field.click()
  await field.fill(name)
  await page
    .getByRole('option', { name: new RegExp(`^${name.replace(/\./g, '\\.')}`) })
    .first()
    .click()
}
