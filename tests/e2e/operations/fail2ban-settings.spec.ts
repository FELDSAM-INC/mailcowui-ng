// UI 011 US5 (T103): the Fail2ban parameters and regex filters — legacy's one form in legacy
// order with its "(s)" labels (plan decision 1), Edit and Save with only the changed values and
// If-Match, the client checks, refused list entries by line, the own-address warning, an outdated
// save, the regex filters with their checks and the reset, the ban list address rotation, and the
// unsaved-changes question.
import type { Page } from '@playwright/test'

import type { MockApi } from '../fixtures/mock-api'
import { expect, test } from '../fixtures/test'

async function open(page: Page, mockApi: MockApi, scenario = 'ops-fail2ban') {
  await mockApi.use(scenario)
  await page.goto('operations/fail2ban')
  await expect(page.locator('[data-parameters]')).toBeVisible({ timeout: 15_000 })
}

async function edit(page: Page) {
  await page.getByRole('button', { name: 'Edit Fail2ban parameters' }).click()
  await expect(page.getByLabel('Ban time (s)', { exact: true })).toBeVisible()
}

async function save(page: Page) {
  await page.getByRole('button', { name: 'Save changes' }).click()
}

async function requestsOf(mockApi: MockApi, operationId: string) {
  return (await mockApi.requests()).filter((request) => request.operationId === operationId)
}

test.describe('Fail2ban parameters @operations', () => {
  test('FR-067 FR-068 US5-AS10 the parameters in seconds under the legacy labels, saved with only the change and If-Match', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await open(page, mockApi)
    await expect(page.locator('[data-parameters] dt')).toHaveText([
      'Ban time (s)',
      'Max. ban time (s)',
      'Ban time is incremented with each ban',
      'Max. attempts',
      'Retry window (s) for max. attempts',
      'IPv4 subnet size to apply ban on (8-32)',
      'IPv6 subnet size to apply ban on (8-128)',
      'Manage Fail2Ban externally',
    ])
    await expect(page.locator('[data-value="banTime"]')).toHaveText('1,800')
    await expectAccessible()
    await edit(page)
    await expect(page).toHaveURL(/edit=parameters/)
    const banTime = page.getByLabel('Ban time (s)', { exact: true })
    await expect(banTime).toHaveAttribute('inputmode', 'numeric')
    await expect(page.getByLabel('Denylisted networks/hosts', { exact: true })).toHaveAttribute(
      'autocapitalize',
      'none',
    )
    await expectAccessible()
    await expectNoHorizontalScroll()
    await expectTouchTargets()
    await banTime.fill('7200')
    await save(page)
    await expect(page.locator('[data-value="banTime"]')).toHaveText('7,200')
    await expect(
      page.getByRole('region', { name: 'Fail2ban parameters' }).getByRole('status'),
    ).toHaveText('Changes to Fail2ban parameters have been saved')
    const [request] = await requestsOf(mockApi, 'updateFail2BanSettings')
    expect(request!.body).toEqual({ banTime: 7200 })
    expect(request!.headers['if-match']).toMatch(/^"f2b/)
  })

  test('US5-AS3 a ban time of 30 seconds is refused on the field and nothing is sent', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await open(page, mockApi)
    await edit(page)
    await page.getByLabel('Ban time (s)', { exact: true }).fill('30')
    await save(page)
    await expect(page.locator('#f2b-banTime-error')).toContainText(
      'Enter a value from 60 to 2,147,483,647.',
    )
    await expect(page.getByLabel('Ban time (s)', { exact: true })).toBeFocused()
    await expectAccessible()
    expect(await requestsOf(mockApi, 'updateFail2BanSettings')).toEqual([])
  })

  test('FR-068 a stored ban time outside the rules is shown as stored and does not block other changes', async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi, 'ops-fail2ban-legacy-values')
    await expect(page.locator('[data-value="banTime"]')).toHaveText('30')
    await edit(page)
    await page.getByLabel('Max. attempts', { exact: true }).fill('5')
    await save(page)
    await expect(page.locator('[data-value="maxAttempts"]')).toHaveText('5')
    const [request] = await requestsOf(mockApi, 'updateFail2BanSettings')
    expect(request!.body).toEqual({ maxAttempts: 5 })
  })

  test('US5-AS4 FR-069 refused denylist entries are named with their line, and the input is kept', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await open(page, mockApi)
    await edit(page)
    const denylist = page.getByLabel('Denylisted networks/hosts', { exact: true })
    await denylist.fill('198.51.100.200\n0.0.0.0/0\n')
    await save(page)
    await expect(page.locator('#f2b-denylist-error')).toContainText(
      'Line 2: Invalid network or host: 0.0.0.0/0',
    )
    expect(await requestsOf(mockApi, 'updateFail2BanSettings')).toEqual([])
    // mailcow's internal network is known only to the server.
    await denylist.fill('  198.51.100.200 \n\n172.22.1.0/24\n198.51.100.200')
    await save(page)
    await expect(page.locator('#f2b-denylist-error')).toContainText(
      'Line 3: Invalid network or host: 172.22.1.0/24',
    )
    await expect(denylist).toHaveValue('  198.51.100.200 \n\n172.22.1.0/24\n198.51.100.200')
    const [request] = await requestsOf(mockApi, 'updateFail2BanSettings')
    expect(request!.body).toEqual({ denylist: ['198.51.100.200', '172.22.1.0/24'] })
    await expectAccessible()
  })

  test('Edge: an entry on both lists is refused with the entry named', async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi)
    await edit(page)
    await page.getByLabel('Denylisted networks/hosts', { exact: true }).fill('192.0.2.0/24')
    await save(page)
    await expect(page.locator('#f2b-denylist-error')).toContainText(
      'Line 1: This conflicts with Allowlisted networks/hosts.',
    )
  })

  test("FR-069 saving a denylist entry that covers the caller's own address asks first", async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi)
    await edit(page)
    await page.getByLabel('Denylisted networks/hosts', { exact: true }).fill('198.51.100.0/24')
    await save(page)
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText(
      'This entry covers your own address 198.51.100.7. You could lock yourself out.',
    )
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    expect(await requestsOf(mockApi, 'updateFail2BanSettings')).toEqual([])
  })

  test('FR-077 several errors are listed in a summary whose entries lead to their fields', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await open(page, mockApi)
    await edit(page)
    await page.getByLabel('Ban time (s)', { exact: true }).fill('30')
    await page.getByLabel('Max. attempts', { exact: true }).fill('0')
    await save(page)
    const summary = page
      .getByRole('heading', { name: 'Please correct the following' })
      .locator('..')
    await expect(summary.getByRole('link')).toHaveCount(2)
    await expectAccessible()
    await summary.getByRole('link').nth(1).click()
    await expect(page.getByLabel('Max. attempts', { exact: true })).toBeFocused()
  })

  test('US5-AS5 FR-072 an outdated save keeps the input and marks what changed meanwhile', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await open(page, mockApi, 'ops-fail2ban-changed-elsewhere')
    await edit(page)
    await page.getByLabel('Max. attempts', { exact: true }).fill('5')
    await save(page)
    const notice = page.locator('[data-outdated]')
    await expect(notice).toContainText('Ban time (s): now saved as 3600')
    await expect(notice).toContainText('Allowlisted networks/hosts: now saved as')
    await expect(page.getByLabel('Max. attempts', { exact: true })).toHaveValue('5')
    await expectAccessible()
    await page.getByRole('button', { name: 'Save again' }).click()
    await expect(page.locator('[data-value="maxAttempts"]')).toHaveText('5')
    await expect(page.locator('[data-value="banTime"]')).toHaveText('3,600')
    const requests = await requestsOf(mockApi, 'updateFail2BanSettings')
    expect(requests).toHaveLength(2)
    expect(requests[1]!.body).toEqual({ maxAttempts: 5 })
  })

  test('Edge: a temporary failure on a save says nothing was changed and keeps the input', async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi)
    await mockApi.patch({
      operations: { inject: { updateFail2BanSettings: { status: 503, times: 1 } } },
    })
    await edit(page)
    await page.getByLabel('Max. attempts', { exact: true }).fill('7')
    await save(page)
    await expect(
      page.getByRole('alert').filter({ hasText: /temporarily unavailable/ }),
    ).toBeVisible()
    await expect(page.getByLabel('Max. attempts', { exact: true })).toHaveValue('7')
    await save(page)
    await expect(page.locator('[data-value="maxAttempts"]')).toHaveText('7')
  })

  test('FR-074 leaving with unsaved changes asks first', async ({ page, mockApi }) => {
    await open(page, mockApi)
    await edit(page)
    await page.getByLabel('Max. attempts', { exact: true }).fill('3')
    const logo = page.locator('[data-shell-logo]:visible')
    await expect(logo).toHaveCount(1)
    await logo.click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Leave without saving?')
    await dialog.getByRole('button', { name: 'Stay' }).click()
    await expect(page).toHaveURL(/operations\/fail2ban/)
    await expect(page.getByLabel('Max. attempts', { exact: true })).toHaveValue('3')
    await logo.click()
    await dialog.getByRole('button', { name: 'Leave', exact: true }).click()
    await expect(page).toHaveURL(/operations\/dashboard$/)
  })

  test('US5-AS7 FR-070 a new ban list address only after a confirmation, then shown with Copy', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await open(page, mockApi)
    const url = page.getByRole('textbox', { name: 'Banlist url' })
    const before = await url.inputValue()
    await page.getByRole('button', { name: 'Refresh banlist ID' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('The current banlist URL stops working at once.')
    await expectAccessible()
    expect(await requestsOf(mockApi, 'rotateFail2BanBanListId')).toEqual([])
    await dialog.getByRole('button', { name: 'Refresh' }).click()
    await expect(page.locator('[data-ban-status]')).toHaveText(
      'Banlist ID has been successfully refreshed.',
    )
    await expect(url).not.toHaveValue(before)
    await expect(page.getByRole('button', { name: 'Copy' })).toBeEnabled()
    const [request] = await requestsOf(mockApi, 'rotateFail2BanBanListId')
    expect(request!.headers['if-match']).toMatch(/^"f2b/)
  })

  test('US5-AS8 a save while the ban service is not running is saved, and the notice says when it applies', async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi, 'ops-fail2ban-not-running')
    await edit(page)
    await page.getByLabel('Max. attempts', { exact: true }).fill('4')
    await save(page)
    await expect(page.locator('[data-value="maxAttempts"]')).toHaveText('4')
    await expect(page.locator('[data-ban-service-stopped]')).toBeVisible()
  })
})

test.describe('Fail2ban regex filters @operations', () => {
  async function openRules(page: Page, mockApi: MockApi, scenario = 'ops-fail2ban') {
    await open(page, mockApi, scenario)
    await page.getByRole('button', { name: 'Regex filters' }).click()
    await expect(page.locator('[data-rule]').first()).toBeVisible()
  }

  test('FR-071 the rules are listed collapsed by default, rows are added and removed, and a refused rule is named', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await open(page, mockApi)
    await expect(page.getByRole('button', { name: 'Regex filters' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    await page.getByRole('button', { name: 'Regex filters' }).click()
    await expect(page.locator('[data-rule]')).toHaveCount(8)
    await expectAccessible()
    await expectNoHorizontalScroll()
    await expectTouchTargets()
    await page.getByRole('button', { name: 'Add row' }).click()
    await expect(page.locator('[data-rule]').last()).toContainText('+')
    await page.getByRole('button', { name: 'Save changes' }).last().click()
    await expect(page.locator('[data-rules]')).toContainText('Enter at least 1 characters.')
    expect(await requestsOf(mockApi, 'replaceFail2BanRules')).toEqual([])
    await page.locator('[data-rule]').last().locator('input').fill('broken (group')
    await page.getByRole('button', { name: 'Save changes' }).last().click()
    await expect(page.locator('[data-rules]')).toContainText(
      'This is not a valid regular expression.',
    )
    await page.locator('[data-rule]').last().getByRole('button', { name: 'Remove row' }).click()
    await page.getByRole('button', { name: 'Save changes' }).last().click()
    await expect(page.locator('[data-rules-status]')).toBeVisible()
    const requests = await requestsOf(mockApi, 'replaceFail2BanRules')
    expect((requests.at(-1)!.body as { rules: string[] }).rules).toHaveLength(8)
    expect(requests.at(-1)!.headers['if-match']).toMatch(/^"rx/)
  })

  test("US5-AS6 the reset asks legacy's question and shows mailcow's defaults", async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await openRules(page, mockApi)
    await page.locator('[data-rule]').first().locator('input').fill('custom ([0-9.]+)')
    await page.getByRole('button', { name: 'Save changes' }).last().click()
    await expect(page.locator('[data-rules-status]')).toBeVisible()
    await page.getByRole('button', { name: 'Reset to default' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Are you sure you want to proceed?')
    await expectAccessible()
    await dialog.getByRole('button', { name: 'Reset to default' }).click()
    await expect(page.locator('[data-rules-status]')).toHaveText(
      'Changes to Fail2ban parameters have been saved',
    )
    await expect(page.locator('[data-rule]').first().locator('input')).toHaveValue(
      /^mailcow UI: Invalid password/,
    )
  })

  test("US5-AS6 when the defaults are not restored in time, legacy's message and Refresh, never a second reset", async ({
    page,
    mockApi,
  }) => {
    await openRules(page, mockApi, 'ops-fail2ban-rules-not-restored')
    await page.getByRole('button', { name: 'Reset to default' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Reset to default' }).click()
    await expect(page.locator('[data-reset-problem]')).toContainText(
      'Regex filter could not be reset in time',
    )
    await page.locator('[data-reset-problem]').getByRole('button', { name: 'Refresh' }).click()
    await expect(page.locator('[data-reset-problem]')).toHaveCount(0)
    expect(await requestsOf(mockApi, 'resetFail2BanRules')).toHaveLength(1)
  })
})
