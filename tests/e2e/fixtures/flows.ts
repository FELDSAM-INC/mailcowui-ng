// Shared steps of the end-to-end specs: signing in through the password form, opening the
// navigation on any viewport, and reading the live regions.
import { expect, type Locator, type Page } from '@playwright/test'

import { MOCK_PASSWORD } from '../../mocks/scenarios/accounts'

export { MOCK_PASSWORD }

export const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024

export function passwordForm(page: Page) {
  return {
    username: page.getByLabel('Username', { exact: true }),
    password: page.getByLabel('Password', { exact: true }),
    submit: page.getByRole('button', { name: 'Sign in', exact: true }),
  }
}

/** Fills and submits the password form of the sign-in screen that is open. */
export async function submitPassword(
  page: Page,
  username: string,
  password: string = MOCK_PASSWORD,
): Promise<void> {
  const form = passwordForm(page)
  await form.username.fill(username)
  await form.password.fill(password)
  await form.submit.click()
}

/** Opens the app signed out and signs in with the password form. */
export async function signInWithPassword(
  page: Page,
  username: string,
  password: string = MOCK_PASSWORD,
  path = '',
): Promise<void> {
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await submitPassword(page, username, password)
}

/** The main navigation, opening the drawer on narrow viewports. */
export async function openNavigation(page: Page): Promise<Locator> {
  if (isNarrow(page)) {
    await page.getByRole('button', { name: 'Open navigation' }).click()
    return page.getByRole('dialog').getByRole('navigation', { name: 'Main navigation' })
  }
  return page.getByRole('navigation', { name: 'Main navigation' })
}

export async function signOutFromMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Account menu of / }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
}

export const politeRegion = (page: Page) => page.locator('[data-live="polite"]')
export const assertiveRegion = (page: Page) => page.locator('[data-live="assertive"]')
