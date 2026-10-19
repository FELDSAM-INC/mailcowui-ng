// UI 012 US6, the history of OAuth2 clients and the audit labels of API 012 (T090, FR-067): the
// client page's History opens the audit log filtered to that client; the target type filter offers
// the identity provider configuration and OAuth2 clients; every record of API 012 shows its
// translated event, sign-in method and failure reason, with its details in UI 001's generic view.
// The identity provider page's History is tested with that page.
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'

const wide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 768

function records(page: Page): Locator {
  return wide(page)
    ? page.getByRole('table', { name: 'Audit records' }).locator('tbody > tr[data-record]')
    : page.getByRole('list', { name: 'Audit records' }).getByRole('listitem')
}

async function filters(page: Page): Promise<Locator> {
  const toggle = page.getByRole('button', { name: 'Filters', exact: true })
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
  return page.getByRole('form', { name: 'Filters' })
}

const summary = (page: Page) => page.getByText(/^Showing \d+ to \d+ of \d+ entries$/)

test.describe('API 012 history', () => {
  test('FR-067 History on a client page opens the records of that client', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('audit-identity-provider')
    await page.goto('identity-providers/oauth2-apps/4')
    await page.getByRole('link', { name: 'History' }).click()
    await expect(page).toHaveURL(/\/ng\/audit-log\?targetType=oauth2Client&targetId=4$/)
    await expect(summary(page)).toHaveText('Showing 1 to 4 of 4 entries')
    await expect(records(page).nth(0)).toContainText('OAuth2 client added')
    await expect(records(page).nth(1)).toContainText('OAuth2 client changed')
    await expect(records(page).nth(2)).toContainText('OAuth2 client secret renewed')
    await expect(records(page).nth(3)).toContainText('OAuth2 client tokens revoked')
    await records(page).nth(3).getByRole('button', { name: 'Show details' }).click()
    const details = page.getByRole('region', { name: /Details of/ }).first()
    await expect(details).toContainText('OAuth2 client')
    await expect(details).toContainText('accessTokens: 12')
    await expect(
      page.getByRole('button', { name: 'Remove filter: OAuth2 client', exact: true }),
    ).toBeVisible()
    await expectAccessible()
    await expectNoHorizontalScroll()
  })

  test('FR-067 the target type filter offers the identity provider configuration and OAuth2 clients', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('audit-identity-provider')
    await page.goto('audit-log')
    const form = await filters(page)
    const options = await form.getByLabel('Target type').locator('option').allTextContents()
    expect(options).toEqual(expect.arrayContaining(['Identity Provider', 'OAuth2 client']))
    await form.getByLabel('Target type').selectOption('identityProvider')
    await form.getByRole('button', { name: 'Apply filters' }).click()
    await expect(summary(page)).toHaveText('Showing 1 to 3 of 3 entries')
    await expect(records(page).nth(0)).toContainText('Identity provider changed')
    await expect(records(page).nth(1)).toContainText('Identity provider connection test')
    await expect(records(page).nth(1)).toContainText('Connection failed')
    await expect(records(page).nth(2)).toContainText('Identity provider removed')
    await records(page).nth(0).getByRole('button', { name: 'Show details' }).click()
    const details = page.getByRole('region', { name: /Details of/ }).first()
    // UI 004 (T106) shows each change as "path: old → new"; a secret only as changed.
    await expect(details).toContainText('syncInterval: 15 → 60')
    await expect(details).toContainText('bindPassword: {"changed":true}')
  })

  test('US6-AS4 sign-ins through the provider show their method and translated reason; no method filter', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('audit-identity-provider')
    await page.goto('audit-log?event=signIn&outcome=failure')
    const mapping = records(page).filter({ hasText: 'No matching attribute mapping' })
    await expect(mapping).toHaveCount(1)
    await expect(mapping).toContainText('Single Sign-On')
    await expect(mapping).toContainText('anna@example.org')
    const form = await filters(page)
    await expect(form.getByLabel(/method/i)).toHaveCount(0)
    for (const reason of [
      'Sign-in expired or already completed',
      'Single sign-on not available',
      'Refused by the identity provider',
      'The identity provider returned an error',
      'Identity provider unavailable',
      'No e-mail address from the identity provider',
      'Mailbox not linked to the identity provider',
      'Automatic mailbox creation is off',
      'Mailbox could not be created',
      'Password could not be verified',
    ]) {
      await expect(records(page).filter({ hasText: reason }).first()).toBeVisible()
    }
    await expect(page.getByRole('main')).not.toContainText('Unknown (')
    const providerError = records(page).filter({
      hasText: 'The identity provider returned an error',
    })
    await providerError.getByRole('button', { name: 'Show details' }).click()
    await expect(page.getByRole('region', { name: /Details of/ }).first()).toContainText(
      'access_denied',
    )
  })

  test('FR-067 the directory password sign-in and the session end are labelled; entries wrap at 360 px', async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('audit-identity-provider')
    await page.goto('audit-log')
    await expect(records(page).filter({ hasText: 'Directory password' }).first()).toBeVisible()
    await expect(
      records(page).filter({ hasText: 'Single sign-on session ended' }).first(),
    ).toBeVisible()
    await expectNoHorizontalScroll()
  })
})
