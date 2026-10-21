import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'

const result = (page: Page) => page.locator('[data-bulk-results]')
const bar = (page: Page) => page.locator('[data-bulk-bar]')
async function select(page: Page, ids: number[]) {
  await page.locator('[data-select-mode]').click()
  for (const id of ids) await page.locator(`[data-quarantine-item="${id}"] input`).check()
}

test('US2 bulk: mixed outcomes retain only failed targets and preserve learning warnings', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
  guardRequests,
}) => {
  // Three UI states each run four axe palettes (light/dark × saved/limit). Allow runner time
  // for all 12 analyses without changing the app waits or any product performance threshold.
  test.setTimeout(60_000)
  void guardRequests
  await mockApi.use('quarantine-bulk-failures')
  await page.goto('quarantine?size=50')
  await select(page, [150, 149, 148, 147, 146, 145, 144])
  await expect(bar(page)).toContainText('7 selected')
  await expectAccessible()
  await expectTouchTargets()
  await bar(page).getByRole('button', { name: 'Deliver to inbox', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Bulk offer 150')
  await expect(dialog).toContainText('example.org')
  await expect(dialog.getByRole('textbox')).toHaveCount(0)
  await expectAccessible()
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(result(page)).toContainText('2 done')
  await expect(result(page)).toContainText('1 not found')
  await expect(result(page)).toContainText('2 refused')
  await expect(result(page)).toContainText('1 failed')
  await expect(result(page)).toContainText('1 changed in the meantime')
  await expect(result(page).locator('[data-alert="danger"]')).toHaveCount(1)
  await expect(bar(page)).toContainText('4 selected')
  await expect(page.locator('[data-quarantine-item] input:checked')).toHaveCount(4)
  await expectAccessible()
  await expectNoHorizontalScroll()
  const writes = (await mockApi.requests()).filter(
    (entry) => entry.operationId === 'applyQuarantineBulkAction',
  )
  expect(writes).toHaveLength(1)
  expect(writes[0]!.body).toMatchObject({
    action: 'release',
    targets: [
      { id: '150', version: expect.any(String) },
      { id: '149' },
      { id: '148' },
      { id: '147' },
      { id: '146' },
      { id: '145' },
      { id: '144' },
    ],
  })
})

test('US2 bulk: removing 100 messages requires the typed count and renders every result', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('quarantine-many')
  await page.goto('quarantine?size=100')
  await page.locator('[data-select-mode]').click()
  await page.locator('[data-select-all] input').check()
  await expect(bar(page)).toContainText('100 selected')
  await bar(page).getByRole('button', { name: 'Remove', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  const submit = dialog.getByRole('button', { name: 'Delete now', exact: true })
  await expect(submit).toBeDisabled()
  await dialog.getByRole('textbox', { name: 'Type 100 to confirm', exact: true }).fill('99')
  await expect(submit).toBeDisabled()
  await dialog.getByRole('textbox').fill('100')
  await submit.click()
  await expect(result(page)).toContainText('100 done')
  await expect(result(page).locator('li')).toHaveCount(100)
  await expect(bar(page)).toContainText('0 selected')
})

test('US2 bulk: select all stops at the server limit and changing the view clears selection', async ({
  page,
  mockApi,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('quarantine-low-bulk-limit')
  await page.goto('quarantine')
  await page.locator('[data-select-mode]').click()
  const all = page.locator('[data-select-all] input')
  await all.check()
  await expect(page.locator('[data-quarantine-item] input:checked')).toHaveCount(10)
  await expect(page.locator('[data-quarantine-item] input:disabled')).toHaveCount(15)
  await expect(page.locator('#quarantine-bulk-limit')).toContainText('at most 10')
  await expectNoHorizontalScroll()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator('[data-quarantine-item]').first()).toHaveAttribute(
    'data-quarantine-item',
    '325',
  )
  await expect(bar(page)).toContainText('0 selected')
  await all.check()
  await expect(bar(page)).toContainText('10 selected')
  await page.locator('[data-page-size] select').selectOption('50')
  await expect(page).toHaveURL(/size=50/)
  await expect(page.locator('[data-quarantine-item]')).toHaveCount(50)
  await expect(bar(page)).toContainText('0 selected')
  await all.check()
  await expect(bar(page)).toContainText('10 selected')
  await page.locator('#quarantine-search').fill('Bulk offer 1')
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('Bulk offer 1')
  await expect(page.locator('[data-quarantine-item]').first()).toHaveAttribute(
    'data-quarantine-item',
    '199',
  )
  await expect(bar(page)).toContainText('0 selected')
  await all.check()
  await expect(bar(page)).toContainText('10 selected')
  await page.goBack()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator('[data-quarantine-item]')).toHaveCount(25)
  await expect(page.locator('[data-quarantine-item]').first()).toHaveAttribute(
    'data-quarantine-item',
    '325',
  )
  await expect(bar(page)).toContainText('0 selected')
  await all.check()
  await expect(bar(page)).toContainText('10 selected')
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    await page.getByRole('columnheader', { name: 'ID', exact: true }).getByRole('button').click()
  } else {
    await page.locator('#quarantine-sort').selectOption('id')
  }
  await expect(page).toHaveURL(/sort=id/)
  await expect(page.locator('[data-quarantine-item]').first()).toHaveAttribute(
    'data-quarantine-item',
    '350',
  )
  await expect(bar(page)).toContainText('0 selected')
  await all.check()
  await expect(bar(page)).toContainText('10 selected')
  await page.locator('[data-filter-toggle]').click()
  await page.locator('#quarantine-virus').selectOption('false')
  await page.locator('[data-filter-panel] button[type="submit"]').click()
  await expect(page).toHaveURL(/virus=false/)
  await expect(bar(page)).toContainText('0 selected')
})

for (const name of ['Deliver to inbox', 'Release']) {
  test(`US2 bulk: ${name} requires acknowledgement of virus messages`, async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('quarantine-mailbox-user')
    await page.goto('quarantine?virus=true')
    await page.locator('[data-select-mode]').click()
    await page.locator('[data-select-all] input').check()
    await bar(page).getByRole('button', { name, exact: true }).click()
    const dialog = page.getByRole('alertdialog')
    const submit = dialog.getByRole('button', { name: 'Confirm', exact: true })
    await expect(submit).toBeDisabled()
    await dialog.getByRole('checkbox', { name: '1 of the selected items contain a virus.' }).check()
    await expectAccessible()
    await submit.click()
    await expect(result(page)).toContainText('1 done')
    const writes = (await mockApi.requests()).filter(
      (entry) => entry.operationId === 'applyQuarantineBulkAction',
    )
    expect(writes).toHaveLength(1)
    expect(writes[0]!.body).toMatchObject({
      action: name === 'Release' ? 'releaseWithoutLearning' : 'release',
    })
  })
}

test('US2 bulk: learning as spam also requires a typed count and cancellation sends nothing', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('quarantine-mailbox-user')
  await page.goto('quarantine')
  await select(page, [30])
  await bar(page).getByRole('button', { name: 'Learn as spam and delete', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(
    dialog.getByRole('button', { name: 'Learn as spam and delete', exact: true }),
  ).toBeDisabled()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(
    (await mockApi.requests()).filter((entry) => entry.operationId === 'applyQuarantineBulkAction'),
  ).toHaveLength(0)
  await expect(bar(page)).toContainText('1 selected')
  await bar(page).getByRole('button', { name: 'Learn as spam and delete', exact: true }).click()
  await dialog.getByRole('textbox', { name: 'Type 1 to confirm', exact: true }).fill('1')
  await dialog.getByRole('button', { name: 'Learn as spam and delete', exact: true }).click()
  await expect(result(page)).toContainText('1 done')
})

test('US2 bulk: 40 selected messages produce 39 deliveries and one not found', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('quarantine-many', {
    quarantine: {
      items: {
        set: Object.fromEntries(
          Array.from({ length: 40 }, (_, index) => [String(350 - index), { virus: false }]),
        ),
      },
    },
  })
  await page.goto('quarantine?size=50')
  await page.locator('[data-select-mode]').click()
  await page.locator('[data-select-all] input').check()
  for (let id = 301; id <= 310; id++)
    await page.locator(`[data-quarantine-item="${id}"] input`).uncheck()
  await mockApi.patch({ quarantine: { items: { remove: [350] } } })
  await bar(page).getByRole('button', { name: 'Deliver to inbox', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('40 selected')
  await expect(dialog.locator('li')).toHaveCount(40)
  await expect(dialog).toContainText('Bulk offer 350')
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(result(page)).toContainText('39 done')
  await expect(result(page)).toContainText('1 not found')
  await expect(result(page).locator('li')).toHaveCount(40)
})

test('US2 bulk: losing a response refreshes the list and never repeats the action', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('quarantine-mailbox-user')
  await page.goto('quarantine')
  await select(page, [30])
  let posts = 0
  await page.route('**/api/v2/quarantine/bulk-actions', async (route) => {
    posts++
    await route.fetch()
    await route.abort()
  })
  await bar(page).getByRole('button', { name: 'Remove', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await dialog.getByRole('textbox', { name: 'Type 1 to confirm', exact: true }).fill('1')
  await dialog.getByRole('button', { name: 'Delete now', exact: true }).click()
  await expect(result(page)).toContainText('Outcome unknown')
  await expect(page.locator('[data-quarantine-item="30"]')).toHaveCount(0)
  await expect(bar(page)).toContainText('0 selected')
  await expect(result(page).getByRole('button', { name: 'Retry the failed ones' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  expect(posts).toBe(1)
})

test('US2 bulk: a whole-request refusal preserves selection', async ({ page, mockApi }) => {
  await mockApi.use('quarantine-mailbox-user')
  await page.goto('quarantine')
  await select(page, [30, 29])
  await mockApi.failNext('applyQuarantineBulkAction', { status: 403 })
  await bar(page).getByRole('button', { name: 'Release', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(bar(page)).toContainText('2 selected')
  await expect(page.locator('[data-quarantine-item] input:checked')).toHaveCount(2)
  await expect(result(page)).toHaveCount(0)
})
