import { expect, test } from '@playwright/test'
import type { SieveFilter } from '@/api'
import { csrfToken, requireLocalStack } from './fixtures/account-api'
import { alice } from './fixtures/accounts'
import { signIn, uniqueName } from './fixtures/domains-api'

test('@005 @local-stack US10 administrator validates, saves, deactivates and deletes a Sieve filter; reseller can read it', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(90_000)
  requireLocalStack(baseURL)
  await signIn(page, 'admin')
  const root = `/api/v2/mailboxes/${encodeURIComponent(alice.username)}/sieve-filters`
  const before = await page.request.get(`${root}?kind=postfilter&active=true`)
  expect(before.status()).toBe(200)
  const active = ((await before.json()) as { data: SieveFilter[] }).data
  const description = uniqueName('smoke-sieve')
  let createdId: number | undefined
  const context = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors: process.env.SMOKE_IGNORE_HTTPS_ERRORS === '1',
  })
  try {
    await page.goto(`mailboxes/${alice.username}/filters/new`)
    await page.getByRole('combobox', { name: /^Filter type/ }).selectOption('postfilter')
    await page.getByLabel(/^Short description/).fill(description)
    await page.getByLabel(/^Script/).fill('unknown_command;')
    await page.getByRole('button', { name: 'Validate', exact: true }).click()
    await expect(page.getByLabel(/^Script/)).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeDisabled()
    await page.getByLabel(/^Script/).fill('keep;')
    await page.getByRole('button', { name: 'Validate', exact: true }).click()
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && response.url().endsWith('/sieve-filters'),
    )
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    const response = await saved
    expect(response.status()).toBe(201)
    const filter = ((await response.json()) as { data: SieveFilter }).data
    createdId = filter.id
    await expect(page).toHaveURL(new RegExp(`/filters/${filter.id}$`))
    const reseller = await context.newPage()
    await signIn(reseller, 'reseller')
    await reseller.goto(`mailboxes/${alice.username}/filters?q=${description}`)
    await expect(reseller.locator(`[data-filter-id="${filter.id}"]`)).toContainText(description)
    await page.getByRole('checkbox', { name: 'Active', exact: true }).uncheck()
    await page.getByRole('button', { name: 'Validate and save', exact: true }).click()
    await expect(page.locator('[data-filter-form]')).toContainText(
      `Changes to mailbox ${alice.username} have been saved`,
    )
    await page.goto(`mailboxes/${alice.username}/filters?q=${description}`)
    const row = page.locator(`[data-filter-id="${filter.id}"]`)
    await expect(row).toContainText('Inactive')
    await row.getByRole('button', { name: `Remove: ${description}`, exact: true }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Delete now', exact: true })
      .click()
    await expect(row).toHaveCount(0)
    expect((await page.request.get(`${root}/${filter.id}`)).status()).toBe(404)
  } finally {
    await context.close()
    if (createdId !== undefined) {
      const read = await page.request.get(`${root}/${createdId}`)
      if (read.status() === 200) {
        const current = ((await read.json()) as { data: SieveFilter }).data
        const removed = await page.request.delete(`${root}/${createdId}`, {
          headers: { 'X-CSRF-Token': await csrfToken(page), 'If-Match': current.etag },
        })
        expect(removed.status()).toBe(204)
      }
    }
    for (const original of active) {
      const read = await page.request.get(`${root}/${original.id}`)
      expect(read.status()).toBe(200)
      const current = ((await read.json()) as { data: SieveFilter }).data
      if (!current.active) {
        const restored = await page.request.patch(`${root}/${current.id}`, {
          headers: {
            'X-CSRF-Token': await csrfToken(page),
            'If-Match': current.etag,
            'Content-Type': 'application/merge-patch+json',
          },
          data: { active: true },
        })
        expect(restored.status()).toBe(200)
      }
    }
  }
})
