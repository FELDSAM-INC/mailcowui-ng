// T138: the audit log against a real mailcow-rest-v2 dev stack (research R25): admin's sign-in of
// this run is listed, and filtering by actor and outcome narrows the list.
import { expect, test, type Page } from '@playwright/test'

import { admin } from './fixtures/accounts'
import { expectHome, signIn } from './fixtures/flows'

// DataTables' entries line of the classic log tables (`datatables.info`, `datatables.infoEmpty`).
const summary = (page: Page) => page.getByText(/^Showing \d+ to \d+ of [\d,]+ entries$/)

async function total(page: Page): Promise<number> {
  const text = (await summary(page).textContent()) ?? ''
  return Number(/of ([\d,]+) entries$/.exec(text)?.[1]?.replace(/,/g, '') ?? 0)
}

test('admin finds this run’s sign-in and narrows the list by actor and outcome', async ({
  page,
}) => {
  const started = Date.now()
  await signIn(page, admin.username, admin.password)
  await expectHome(page, admin.username)
  await page.goto('audit-log')
  await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible()
  await expect(summary(page)).toBeVisible()
  const all = await total(page)
  expect(all).toBeGreaterThan(0)

  const toggle = page.getByRole('button', { name: 'Filters', exact: true })
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
  const form = page.getByRole('form', { name: 'Filters' })
  await form.getByRole('checkbox', { name: 'Sign-in' }).check()
  await form.getByLabel('Outcome').selectOption('success')
  await form.getByLabel('User or API key').fill(admin.username)
  await form.getByRole('button', { name: 'Apply filters' }).click()
  await expect(page).toHaveURL(/actor=/)
  await expect(summary(page)).toBeVisible()
  const narrowed = await total(page)
  expect(narrowed).toBeGreaterThan(0)
  expect(narrowed).toBeLessThanOrEqual(all)

  const newest = page.locator('time').first()
  const at = Date.parse((await newest.getAttribute('datetime')) ?? '')
  expect(at).toBeGreaterThanOrEqual(started - 60_000)
})
