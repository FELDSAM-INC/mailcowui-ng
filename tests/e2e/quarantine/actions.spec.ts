import { expect, test } from '../fixtures/test'
import { itemAction, openItem } from './helpers'

test('US1-AS4 action: deliver once with learning and return to the filtered list', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('quarantine-mailbox-user')
  await page.goto('quarantine?q=newsletter')
  await page.locator('[data-quarantine-item="2"]').press('Enter')
  await expect(page.locator('[data-item="2"]')).toBeVisible()
  await mockApi.delay('releaseQuarantineItem', 350)
  await itemAction(page, 'release')
  await expect(page.locator('[data-item-action="release"]')).toBeDisabled()
  await expect(page).toHaveURL(/quarantine\?q=newsletter$/)
  await expect(page.locator('[data-outcome]')).toContainText('Item 2 released')
  await expect(page.locator('[data-outcome]')).toContainText('learned ID 2 as ham')
  const writes = (await mockApi.requests()).filter(
    (entry) => entry.operationId === 'releaseQuarantineItem',
  )
  expect(writes).toHaveLength(1)
  expect(writes[0]!.body).toEqual({ learnAsHam: true })
  expect(writes[0]!.headers['if-match']).toMatch(/^"q/)
  await expectAccessible()
})

test('US1 actions: release without learning, learn as spam and remove use their confirmations', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('quarantine-mailbox-user')
  for (const [id, action, label] of [
    [2, 'releaseWithoutLearning', 'Confirm'],
    [3, 'learnAsSpam', 'Learn as spam and delete'],
    [4, 'delete', 'Delete now'],
  ] as const) {
    await openItem(page, id)
    await itemAction(page, action)
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText(String(id))
    await expectAccessible()
    await dialog.getByRole('button', { name: label, exact: true }).click()
    await expect(page).toHaveURL(/\/quarantine$/)
    await expect(page.locator(`[data-quarantine-item="${id}"]`)).toHaveCount(0)
  }
  const release = (await mockApi.requests()).find(
    (entry) => entry.operationId === 'releaseQuarantineItem',
  )
  expect(release!.body).toEqual({ learnAsHam: false })
})

test('US1-AS6 action: delivered mail remains successful when learning or fuzzy learning fails', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('quarantine-mailbox-user', {
    quarantine: {
      items: {
        set: { '2': { inject: { learning: 'failed' } }, '3': { inject: { fuzzy: 'failed' } } },
      },
    },
  })
  await openItem(page, 2)
  await itemAction(page, 'release')
  await expect(page).toHaveURL(/\/quarantine$/)
  await expect(page.locator('[data-alert="success"]')).toContainText('Item 2 released')
  await expect(page.locator('[data-alert="danger"]')).toHaveCount(1)
  await expect(page.locator('[data-alert="warning"]')).toHaveCount(0)
  await openItem(page, 3)
  await itemAction(page, 'release')
  await expect(page).toHaveURL(/\/quarantine$/)
  await expect(page.locator('[data-alert="warning"]')).toHaveCount(1)
  await expectAccessible()
})

test('US1-AS7 action: a virus delivery needs acknowledgement and forbidden actions disappear', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('quarantine-mailbox-user')
  await openItem(page, 5)
  await itemAction(page, 'release')
  const dialog = page.getByRole('alertdialog')
  const submit = dialog.getByRole('button', { name: 'Deliver to inbox', exact: true })
  await expect(submit).toBeDisabled()
  await dialog.getByRole('checkbox').check()
  await expectAccessible()
  await submit.click()
  await expect(page).toHaveURL(/\/quarantine$/)
  await openItem(page, 2)
  await mockApi.setFlags('alice@example.org', { quarantine: false })
  await itemAction(page, 'release')
  await expect(page.locator('#qitem-acl-quarantine')).toBeVisible()
  await expect(page.locator('[data-item-actions]')).toHaveCount(0)
  await expect(page.locator('[data-outcome]')).toBeVisible()
})

test('FR-030 action: refused delivery keeps the item and exposes bidi controls in the server answer', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('quarantine-mailbox-user', {
    quarantine: {
      items: {
        set: {
          '2': {
            inject: { deliveryRefused: { smtpCode: 550, smtpResponse: 'Unknown \u202Eaddress' } },
          },
        },
      },
    },
  })
  await openItem(page, 2)
  await itemAction(page, 'release')
  await expect(page.locator('[data-outcome]')).toContainText('550')
  await expect(page.locator('[data-outcome] [data-marker]')).toContainText('U+202E')
  await expect(page.locator('[data-item="2"]')).toBeVisible()
  await expectAccessible()
})

test('FR-030 action: a lost delivery response never resends and refreshes the item', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('quarantine-mailbox-user')
  await openItem(page, 2)
  let sends = 0
  await page.route('**/api/v2/quarantine/2/release', async (route) => {
    sends++
    await route.fetch()
    await route.abort()
  })
  await itemAction(page, 'release')
  await expect(page).toHaveURL(/\/quarantine$/)
  await expect(page.locator('[data-outcome]')).toContainText(
    'unknown whether the action was completed',
  )
  expect(sends).toBe(1)
})

test('US2-AS7 busy item: rechecks once after Retry-After and returns when the item is gone', async ({
  page,
  mockApi,
}) => {
  await page.clock.install()
  await mockApi.use('quarantine-busy')
  await openItem(page, 1)
  await itemAction(page, 'release')
  await expect(page.locator('[data-outcome]')).toContainText('Another action')
  await page.clock.fastForward(5000)
  await expect(page).toHaveURL(/\/quarantine$/)
  expect(
    (await mockApi.requests()).filter((entry) => entry.operationId === 'releaseQuarantineItem'),
  ).toHaveLength(1)
})
