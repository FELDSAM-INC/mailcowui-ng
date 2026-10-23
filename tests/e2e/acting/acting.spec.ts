import { chooseTheme } from '../fixtures/flows'
import { test, expect } from '../fixtures/test'
import { clickRowAction, rowAction } from '../fixtures/row-actions'

test('US2-AS7 failed Return can retry, while Sign out completely ends both identities', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('acting-admin')
  await page.goto('mailboxes?q=alice')
  await clickRowAction(
    page,
    page.locator('[data-entry="alice@example.org"]'),
    'Login alice@example.org',
  )
  await expect(page.locator('[data-acting-banner]')).toBeVisible()
  await mockApi.failNext('endImpersonation', { status: 500 })
  await page.locator('[data-acting-return]').click()
  await expect(page.locator('[data-acting-banner] [role="alert"]')).toBeVisible()
  await expectAccessible()
  await page
    .locator('[data-acting-banner]')
    .getByRole('button', { name: 'Try again', exact: true })
    .click()
  await expect(page).toHaveURL(/\/mailboxes\?q=alice$/)
  await clickRowAction(
    page,
    page.locator('[data-entry="alice@example.org"]'),
    'Login alice@example.org',
  )
  await expect(page.locator('[data-acting-banner]')).toBeVisible()
  await page.getByRole('button', { name: 'Account menu of alice@example.org' }).click()
  await page.getByRole('menuitem', { name: 'Sign out completely', exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.locator('[data-acting-banner]')).toHaveCount(0)
  await expect(page).not.toHaveTitle(/^Acting as/)
  await expectAccessible()
})

for (const scenario of ['acting-target-forced', 'acting-target-inactive']) {
  test(`US2 edge ${scenario} remains eligible and ignores target sign-in restrictions`, async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use(scenario)
    await page.goto('mailboxes?q=alice')
    await clickRowAction(
      page,
      page.locator('[data-entry="alice@example.org"]'),
      'Login alice@example.org',
    )
    await expect(page.locator('[data-acting-banner]')).toBeVisible()
    await expect(page).not.toHaveURL(/pending-actions/)
    await expectAccessible()
    await page.locator('[data-acting-return]').click()
    await expect(page).toHaveURL(/\/mailboxes\?q=alice$/)
  })
}

test('US2-AS1/AS3 mailbox Login shows a persistent banner and returns to the exact filtered list', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await mockApi.use('acting-admin')
  await page.goto('mailboxes?q=alice')
  await clickRowAction(
    page,
    page.locator('[data-entry="alice@example.org"]'),
    'Login alice@example.org',
  )
  const banner = page.locator('[data-acting-banner]')
  await expect(banner).toContainText('alice@example.org')
  await expect(banner).toContainText('mailbox user')
  await expect(banner).toContainText('admin')
  await expect(page).toHaveURL(/\/account\/password$/)
  await expect(page).toHaveTitle(/^Acting as alice@example.org/)
  await expect(page.locator('[data-row-actions]')).toHaveCount(0)
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
  for (const path of [
    'account/password',
    'account/two-factor',
    'account/recovery-email',
    'passkeys',
  ]) {
    await page.goto(path)
    await expect(banner).toBeVisible()
    await expect(page.locator('main')).toContainText('Not available while acting as another user')
    await expect(page.locator('main input[type="password"]')).toHaveCount(0)
    await expectAccessible()
  }
  // Browser navigation above models a reload: the origin is intentionally memory-only.
  await page.locator('[data-acting-return]').click()
  await expect(banner).toHaveCount(0)
  await expect(page).not.toHaveTitle(/^Acting as/)
  await page.goto('mailboxes?q=alice')
  await clickRowAction(
    page,
    page.locator('[data-entry="alice@example.org"]'),
    'Login alice@example.org',
  )
  await expect(banner).toBeVisible()
  await page.locator('[data-acting-return]').click()
  await expect(page).toHaveURL(/\/mailboxes\?q=alice$/)
  await expect(
    await rowAction(
      page,
      page.locator('[data-entry="alice@example.org"]'),
      'Login alice@example.org',
    ),
  ).toBeVisible()
})

test('US2-AS5 domain administrator list and detail expose Login without nested acting', async ({
  page,
  mockApi,
  expectAccessible,
  expectTouchTargets,
}) => {
  await mockApi.use('acting-admin')
  await page.goto('administrators/domain-admins')
  await page.getByRole('button', { name: 'Actions for reseller', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Login reseller', exact: true }).click()
  await expect(page.locator('[data-acting-banner]')).toContainText('domain administrator')
  await page.goto('mailboxes')
  const rowMenus = page.locator('[data-row-action-trigger]')
  if (await rowMenus.count()) await rowMenus.first().click()
  await expect(page.getByRole('menuitem', { name: /^Login / })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Login / })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expectAccessible()
  await expectTouchTargets()
  await page.locator('[data-acting-return]').click()
  await page.goto('administrators/domain-admins/reseller')
  await page.getByRole('button', { name: 'Login reseller', exact: true }).click()
  await expect(page.locator('[data-acting-banner]')).toBeVisible()
  await page.locator('[data-acting-return]').click()
  await expect(page).toHaveURL(/\/administrators\/domain-admins\/reseller$/)
})

test('US2-AS4 loginAs controls scoped mailbox actions and refusals preserve the original view', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('acting-reseller-no-login-as')
  await page.goto('mailboxes?q=alice')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const rowMenus = page.locator('[data-row-action-trigger]')
  if (await rowMenus.count()) await rowMenus.first().click()
  await expect(page.getByRole('menuitem', { name: /^Login / })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Login / })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await mockApi.use('acting-reseller-login-as')
  await page.reload()
  await expect(
    await rowAction(
      page,
      page.locator('[data-entry="alice@example.org"]'),
      'Login alice@example.org',
    ),
  ).toBeVisible()
  await mockApi.failNext('startImpersonation', { status: 409, type: 'already-impersonating' })
  await clickRowAction(
    page,
    page.locator('[data-entry="alice@example.org"]'),
    'Login alice@example.org',
  )
  await expect(page.getByRole('alert')).toContainText('already')
  await expect(page.locator('[data-acting-banner]')).toHaveCount(0)
  await expect(page).toHaveURL(/\/mailboxes\?q=alice$/)
  await expectAccessible()
})

test('US2-AS9 server-ended acting refuses the write once and restores the owner', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('acting-admin')
  await page.goto('mailboxes?q=alice')
  await clickRowAction(
    page,
    page.locator('[data-entry="alice@example.org"]'),
    'Login alice@example.org',
  )
  await expect(page.locator('[data-acting-banner]')).toBeVisible()
  await mockApi.patch({ invalidateImpersonation: true })
  const mark = await mockApi.mark()
  await chooseTheme(page, 'Dark')
  await expect(page.locator('[data-acting-banner]')).toHaveCount(0)
  await expect(page).toHaveURL(/\/mailboxes\?q=alice$/)
  await expect(page.locator('main')).toContainText('Your last action was not carried out')
  const writes = (await mockApi.requests())
    .slice(mark)
    .filter((request) => request.operationId === 'updatePreferences')
  expect(writes).toHaveLength(1)
  expect(writes[0]!.status).toBe(403)
  await expectAccessible()
})

test('FR-054 acting and returning update another tab without exposing the previous role', async ({
  page,
  context,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('acting-admin')
  await page.goto('mailboxes?q=alice')
  const other = await context.newPage()
  await other.goto('administrators/admins')
  await expect(other.getByRole('heading', { level: 1 })).toBeVisible()
  await clickRowAction(
    page,
    page.locator('[data-entry="alice@example.org"]'),
    'Login alice@example.org',
  )
  await expect(other.locator('[data-acting-banner]')).toContainText('alice@example.org')
  await expect(other.locator('[data-account-row]')).toHaveCount(0)
  await expectAccessible(other)
  await page.locator('[data-acting-return]').click()
  await expect(other.locator('[data-acting-banner]')).toHaveCount(0)
  await other.close()
})

test('FR-053 stale CSRF never replays a write after an out-of-band identity switch', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('acting-admin')
  await page.goto('mailboxes?q=alice')
  await expect(
    await rowAction(
      page,
      page.locator('[data-entry="alice@example.org"]'),
      'Login alice@example.org',
    ),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  const csrf = (await (await page.request.get('/api/v2/csrf-token')).json()) as {
    data: { token: string }
  }
  const start = await page.request.post('/api/v2/session/impersonation', {
    headers: { 'X-CSRF-Token': csrf.data.token },
    data: { role: 'mailboxUser', username: 'alice@example.org' },
  })
  expect(start.status()).toBe(201)
  const mark = await mockApi.mark()
  await chooseTheme(page, 'Dark')
  await expect(page.locator('[data-acting-banner]')).toContainText('alice@example.org')
  await expect(page.locator('main')).toContainText('The account changed in another tab')
  await expect(page.locator('main')).toContainText('Your last action was not carried out')
  expect(
    (await mockApi.requests())
      .slice(mark)
      .filter((request) => request.operationId === 'updatePreferences'),
  ).toHaveLength(1)
  await expectAccessible()
})
