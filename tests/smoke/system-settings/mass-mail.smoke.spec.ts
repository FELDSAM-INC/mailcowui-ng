import { expect, test } from '@playwright/test'
import type { paths } from '@/api'
import { requireLocalStack } from '../fixtures/account-api'
import { admin } from '../fixtures/accounts'
import { expectHome, signIn, signOut } from '../fixtures/flows'

test('@013 @local-stack administrator previews receiving mailboxes without sending', async ({
  page,
  baseURL,
}) => {
  requireLocalStack(baseURL)
  await signIn(page, admin.username, admin.password)
  await expectHome(page, admin.username)
  const response = await page.request.get(
    '/api/v2/mailboxes?limit=1&status=active&status=loginDisabled',
  )
  expect(response.status()).toBe(200)
  type MailboxPage = paths['/mailboxes']['get']['responses'][200]['content']['application/json']
  const expected = ((await response.json()) as MailboxPage).meta.total
  let sends = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v2/mass-mail-jobs')
      sends++
  })
  await page.goto('system/mass-mail/send')
  await page.locator('#mass-subject').fill('Isolated preview only')
  await page.locator('#mass-textBody').fill('This draft is never sent.')
  await page.getByRole('button', { name: 'Preview recipients', exact: true }).click()
  await expect(page.locator('[data-recipient-count]')).toHaveText(`${expected} recipients`)
  expect(sends).toBe(0)
  // Discard this unsent draft by loading a fresh document before signing out.
  await page.goto('system/mass-mail/jobs')
  await signOut(page)
})
