// Steps shared by the smoke specs, against a real mailcow-rest-v2 instance.
import { expect, type Page } from '@playwright/test'

export async function signIn(page: Page, username: string, password: string, path = 'sign-in') {
  await page.goto(path)
  await page.getByLabel('Username', { exact: true }).fill(username)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: /^Account menu of / }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page.getByRole('main').getByText('You have signed out.')).toBeVisible()
}

export async function expectHome(page: Page, username: string) {
  await expect(page.getByRole('heading', { level: 1, name: `Hello, ${username}` })).toBeVisible()
}
