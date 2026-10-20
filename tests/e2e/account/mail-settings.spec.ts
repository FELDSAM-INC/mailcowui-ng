import { expect, test } from '../fixtures/test'

test('US7-AS1 FR-014 legacy tagging/TLS save on change, expose pending state and keep warning visible', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/mail-settings')
  await expect(page.locator('[data-value="none"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-tls-warning]')).toBeVisible()
  await expect(page.getByRole('main')).toContainText('me+Facebook@example.org')
  await expectAccessible()
  await expectNoHorizontalScroll()
  await mockApi.delay('updateMailboxMailSettings', 700)
  await page.locator('[data-value="subject"]').click()
  await expect(page.locator('[data-value="subject"]')).toBeDisabled()
  await expect(page.locator('[data-value="subject"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('main')).toContainText('Changes to mailbox anna@example.org')
  await page.locator('[data-tls="outbound"]').click()
  await expect(page.locator('[data-tls="outbound"]')).toHaveAttribute('aria-pressed', 'true')
  const writes = (await mockApi.requests()).filter(
    (request) => request.operationId === 'updateMailboxMailSettings',
  )
  expect(writes).toHaveLength(2)
  await expectAccessible()
})

test('FR-014 a failed setting change keeps the stored choice and names the unavailable service', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/mail-settings')
  await expect(page.locator('[data-value="none"]')).toHaveAttribute('aria-pressed', 'true')
  await mockApi.patch({ selfService: { outages: { sharedStore: true } } })
  await page.locator('[data-value="subject"]').click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('shared store')
  await expect(page.locator('[data-value="none"]')).toHaveAttribute('aria-pressed', 'true')
  expect(await mockApi.countRequests('updateMailboxMailSettings')).toBe(1)
  await expectAccessible()
})

test('FR-016 a conflict reloads the other saved choice without resending', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/mail-settings')
  await expect(page.locator('[data-value="none"]')).toHaveAttribute('aria-pressed', 'true')
  await mockApi.patch({
    mailboxes: { set: { 'anna@example.org': { taggedMailHandling: 'subfolder' } } },
  })
  await page.locator('[data-value="subject"]').click()
  await expect(page.locator('[data-outdated]')).toContainText('changed elsewhere')
  await expect(page.locator('[data-value="subfolder"]')).toHaveAttribute('aria-pressed', 'true')
  expect(await mockApi.countRequests('updateMailboxMailSettings')).toBe(1)
  await expectAccessible()
})

test('SC-009 without settings flags the section is hidden and its direct URL reads no settings', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-mailbox-no-flags')
  await page.goto('account')
  await expect(page.locator('[data-section="mailSettings"]')).toHaveCount(0)
  await page.goto('account/mail-settings')
  await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
  expect(await mockApi.countRequests('getMailboxMailSettings')).toBe(0)
  await expectAccessible()
})

test('US11-AS1 AS2 confirms resets with the SOGo acknowledgement and restores keyboard focus', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/mail-settings')
  const reset = page.locator('[data-reset-activesync]')
  await reset.click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('anna@example.org')
  await expectAccessible()
  await expectNoHorizontalScroll()
  await dialog.getByRole('button', { name: 'Delete now' }).click()
  await expect(page.getByRole('main')).toContainText('anna@example.org')
  await expect(reset).toBeFocused()
  await page.locator('[data-reset-groupware]').click()
  const deletion = dialog.getByRole('button', { name: 'Delete now' })
  await expect(deletion).toBeDisabled()
  await expectAccessible()
  await dialog
    .getByRole('checkbox', { name: 'I understand that my contacts and calendars will be deleted' })
    .check()
  await expect(deletion).toBeEnabled()
  await deletion.click()
  await expect(dialog).toHaveCount(0)
  expect(await mockApi.countRequests('resetActiveSyncCache')).toBe(1)
  expect(await mockApi.countRequests('resetGroupwareProfile')).toBe(1)
})

test('US11-AS3 SC-009 disabled groupware removes reset actions and preserves ordinary mail settings', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-groupware-disabled')
  await page.goto('account/mail-settings')
  await expect(page.locator('[data-value="none"]')).toBeVisible()
  await expect(page.locator('[data-reset-activesync], [data-reset-groupware]')).toHaveCount(0)
  await expectAccessible()
  await expectNoHorizontalScroll()
})

test('FR-088 a server-side groupware-disabled refusal is explained after confirmation', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/mail-settings')
  await page.locator('[data-reset-activesync]').click()
  await mockApi.patch({ selfService: { groupwareEnabled: false } })
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  expect(await mockApi.countRequests('resetActiveSyncCache')).toBe(1)
  await expectAccessible()
})

test('US7-AS1 D6 administrators save tagging and TLS in their original mailbox section', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-admin')
  await page.goto('mailboxes/anna@example.org')
  const section = page.locator('#section-mailbox')
  await section.getByRole('button', { name: 'Edit Edit mailbox', exact: true }).click()
  const tag = section.locator('#section-mailbox-taggedMail-subject')
  await tag.check()
  await section.locator('#section-mailbox-tls-outbound').check()
  expect(await mockApi.countRequests('updateMailboxMailSettings')).toBe(0)
  await expectAccessible()
  await expectNoHorizontalScroll()
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(
    section.getByRole('status').filter({ hasText: 'Changes to mailbox anna@example.org' }),
  ).toBeVisible()
  expect(await mockApi.countRequests('updateMailboxMailSettings')).toBe(1)
  await expect(section).toContainText('In subject')
})

test('US11 administrator mailbox context allows both resets and hides them when groupware is disabled', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-admin')
  await page.goto('mailboxes/anna@example.org/mail-settings')
  await expect(page.locator('[data-reset-activesync]')).toBeVisible()
  await expect(page.locator('[data-reset-groupware]')).toBeVisible()
  await expect(page.getByRole('main')).toContainText('anna@example.org')
  await expectAccessible()
  await expectNoHorizontalScroll()
  await page.locator('[data-reset-activesync]').click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
  expect(await mockApi.countRequests('resetActiveSyncCache')).toBe(1)
  await mockApi.use('account-admin', { selfService: { groupwareEnabled: false } })
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
  await expect(page.locator('[data-reset-activesync], [data-reset-groupware]')).toHaveCount(0)
})
