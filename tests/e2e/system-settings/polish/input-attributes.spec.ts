import type { Locator } from '@playwright/test'
import { expect, test } from '../../fixtures/test'

async function literalInput(input: Locator, mode: string) {
  await expect(input).toHaveAttribute('inputmode', mode)
  await expect(input).toHaveAttribute('autocapitalize', /^(off|none)$/)
  await expect(input).toHaveAttribute('autocorrect', 'off')
}

test('T171 literal values retain mobile keyboards and valid relative app URLs', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  test.setTimeout(90_000)
  await mockApi.use('app-links-three')
  await page.goto('system/customize/app-links')
  const links = page.locator('#section-app-links')
  await links.getByRole('button', { name: /^Edit / }).click()
  const url = page.locator('#app-link-0-url')
  // The API accepts /relative paths. Native type=url rejects them, so type=text plus
  // inputmode=url deliberately reconciles T171 with the actual contract.
  await expect(url).toHaveAttribute('type', 'text')
  await literalInput(url, 'url')
  await literalInput(page.locator('#app-link-0-signedInUrl'), 'url')
  await url.fill('/help')
  expect(await url.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(true)
  await links.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(links.locator('form')).toHaveCount(0)

  await page.goto('system/customize/colours')
  await page
    .locator('#section-brand-colours')
    .getByRole('button', { name: /^Edit / })
    .click()
  await literalInput(page.locator('#brand-colour-light'), 'text')
  await literalInput(page.locator('#brand-colour-dark'), 'text')
  await expectAccessible()

  await mockApi.use('quota-copies-example-org')
  await page.goto('domains/example.org')
  await page
    .locator('#section-quota-copies')
    .getByRole('button', { name: /^Edit / })
    .click()
  await literalInput(page.locator('#quota-copies-recipients'), 'email')
  await mockApi.use('mass-mail-120')
  await page.goto('system/mass-mail/send')
  await page.getByLabel('Include/Exclude', { exact: true }).selectOption('exclude')
  await literalInput(page.getByLabel('Paste mailbox addresses'), 'email')
  await expectAccessible()
})
