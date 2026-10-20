import { expect, test } from '../fixtures/test'

test('US4 spam scores validate order, save tenths with a version and reset to defaults', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('spam-score-defaults')
  await page.goto('spam-filter')
  const junk = page.getByRole('textbox', { name: /^Junk folder from/ })
  const reject = page.getByRole('textbox', { name: /^Reject from/ })
  await expect(junk).toHaveValue('8')
  await junk.fill('16.0')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(junk).toHaveAttribute('aria-invalid', 'true')
  expect(
    (await mockApi.requests()).filter((r) => r.operationId === 'setMailboxSpamScore'),
  ).toHaveLength(0)
  await junk.fill('6.5')
  await reject.fill('12.0')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('[data-using-defaults]')).toHaveCount(0)
  await expectAccessible()
  await expectNoHorizontalScroll()
  await page.getByRole('button', { name: 'Reset to server default', exact: true }).click()
  await expect(junk).toHaveValue('8')
  await expect(reject).toHaveValue('15')
})

test('US4 policy entries: normalized add, duplicate refusal, own removal and inherited protection', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('policy-user')
  await page.goto('spam-filter')
  const allow = page.locator('[data-policy-list="allow"]')
  const input = allow.locator('[data-add-entry] input')
  await input.fill(' *@NEW.Example ')
  await allow.locator('[data-add-entry] button').click()
  await expect(allow.locator('[data-entry]').filter({ hasText: '*@new.example' })).toBeVisible()
  await input.fill('*@new.example')
  await allow.locator('[data-add-entry] button').click()
  await expect(allow.locator('[data-field-error]')).toBeVisible()
  const added = allow.locator('[data-entry]').filter({ hasText: '*@new.example' })
  await added.getByRole('checkbox').check()
  await allow.locator('[data-remove-selected]').click()
  await expectAccessible()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Delete now', exact: true })
    .click()
  await expect(added).toHaveCount(0)
  const blockSwitch = page.locator('[data-list-option="block"]')
  if (await blockSwitch.isVisible()) await blockSwitch.click()
  const inherited = page.locator('[data-policy-list="block"] [data-entry="1"]')
  await expect(inherited).toContainText('*@spam.example')
  await expect(inherited.getByRole('checkbox')).toHaveCount(0)
  await expectAccessible()
})

test('US4 revoked policy permission removes write controls after a refusal', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('policy-user')
  await page.goto('spam-filter')
  const allow = page.locator('[data-policy-list="allow"]')
  await allow.locator('[data-add-entry] input').fill('new@example.org')
  await mockApi.setFlags('alice@example.org', { spamPolicy: false })
  await allow.locator('[data-add-entry] button').click()
  await expect(allow.locator('[data-add-entry]')).toHaveCount(0)
  await expect(allow).toContainText('Prohibited by ACL')
  await expectAccessible()
})
