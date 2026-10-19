// UI 003 US8, renaming a mailbox (T112) on legacy's "Rename mailbox" tab: the backup
// acknowledgement, the prefilled local part, "Create alias automatically", legacy's success on the
// new address, and the failures: a taken address, an inactive mailbox, the alias limit, a changed
// mailbox, an undone webmail step, an incomplete rename and an unknown outcome.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'

const section = (page: Page) => page.locator('#section-rename')

async function openRename(page: Page, address: string) {
  await page.goto(`mailboxes/${address}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Edit mailbox' })).toBeVisible()
  await expect(section(page).getByRole('heading', { name: '⚠️ Rename mailbox' })).toBeVisible()
  await expect(section(page).getByLabel('New local mailbox name')).toHaveCount(0)
  await section(page).getByLabel('I have created a backup.').check()
}

async function submit(page: Page, localPart: string, alias = true) {
  await section(page).getByLabel('New local mailbox name').fill(localPart)
  if (!alias) await section(page).getByLabel('Create alias automatically').uncheck()
  await section(page).getByRole('button', { name: 'Save changes' }).click()
}

async function renames(mockApi: {
  requests(): Promise<{ operationId: string | null; status: number }[]>
}) {
  return (await mockApi.requests()).filter((request) => request.operationId === 'renameMailbox')
}

test.describe('mailbox rename', () => {
  test('US8-AS1 FR-048 FR-051 acknowledge, rename keeping the alias, and the new address opens with legacy’s message', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('admin-rename')
    await openRename(page, 'anna@a.example')
    await expect(section(page).getByLabel('New local mailbox name')).toHaveValue('anna')
    await expect(section(page).getByLabel('Create alias automatically')).toBeChecked()
    await expectAccessible()
    await expectNoHorizontalScroll()
    await submit(page, 'anna.smith')
    await expect(page).toHaveURL(/\/ng\/mailboxes\/anna\.smith@a\.example$/)
    await expect(page.locator('[data-flash="success"]')).toHaveText(
      'Mailbox was renamed from anna@a.example to anna.smith@a.example',
    )
    await page.goto('mailboxes?q=anna')
    await expect(page.locator('[data-entry="anna.smith@a.example"]')).toBeVisible()
    await expect(page.locator('[data-entry="anna@a.example"]')).toHaveCount(0)
  })

  test('FR-049 an unchanged name is refused before sending', async ({ page, mockApi }) => {
    await mockApi.use('admin-rename')
    await openRename(page, 'anna@a.example')
    await submit(page, 'ANNA')
    await expect(section(page)).toContainText('The new value is the same as the current one.')
    expect(await renames(mockApi)).toHaveLength(0)
  })

  test('US8-AS2 FR-052 a taken address names its holder on the field and changes nothing', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-rename')
    await openRename(page, 'anna@a.example')
    await submit(page, 'taken')
    await expect(section(page).getByLabel('New local mailbox name')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await expect(section(page)).toContainText('taken@a.example')
    await expect(page).toHaveURL(/anna@a\.example$/)
  })

  test('US8-AS3 an inactive mailbox cannot be renamed', async ({ page, mockApi }) => {
    await mockApi.use('admin-rename')
    await openRename(page, 'carl@a.example')
    await submit(page, 'carlos')
    await expect(section(page).locator('[data-form-error]')).toHaveText(
      'Only active mailboxes and mailboxes with login disallowed can be renamed.',
    )
  })

  test('US8-AS6 the alias limit is reported, and renaming without the alias works', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-rename')
    await openRename(page, 'fay@full.example')
    await submit(page, 'faye')
    await expect(section(page).locator('[data-form-error]')).toHaveText('Max. aliases exceeded')
    await submit(page, 'faye', false)
    await expect(page).toHaveURL(/faye@full\.example$/)
  })

  test('US8-AS4 the webmail step failed and was undone: the old address stays', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-rename')
    await openRename(page, 'webfail@a.example')
    await submit(page, 'web.new')
    await expect(section(page).locator('[data-form-error]')).toContainText('Nothing was changed')
    await expect(page).toHaveURL(/webfail@a\.example$/)
  })

  test('US8-AS5 an incomplete rename leaves a report with every step until it is dismissed', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('admin-rename')
    await openRename(page, 'broken@a.example')
    await submit(page, 'broken.new')
    const report = section(page).locator('[data-rename-report]')
    await expect(report).toHaveAttribute('role', 'alert')
    await expect(report).toContainText('Previous address: broken@a.example')
    await expect(report).toContainText('New address: broken.new@a.example')
    await expect(report).toContainText('Contact the server operator')
    await expect(report.locator('[data-step]')).toHaveCount(6)
    await expectAccessible()
    await expect(page).toHaveURL(/broken@a\.example$/)
    await report.getByRole('button', { name: 'Close' }).click()
    await expect(report).toHaveCount(0)
  })

  test('504 the report names the step whose outcome is unknown', async ({ page, mockApi }) => {
    await mockApi.use('admin-rename')
    await openRename(page, 'slow@a.example')
    await submit(page, 'slow.new')
    await expect(section(page).locator('[data-unknown-step]')).toHaveText(
      'Unknown outcome: Moving the mail',
    )
  })

  test('412 FR-044 a mailbox changed elsewhere: nothing changes, reloaded, confirm again', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-rename')
    await openRename(page, 'anna@a.example')
    await mockApi.patch({ mailboxes: { set: { 'anna@a.example': { displayName: 'Changed' } } } })
    await submit(page, 'anna.smith')
    await expect(section(page).locator('[data-form-error]')).toContainText('changed elsewhere')
    await expect(page.locator('#section-mailbox')).toContainText('Changed')
    await section(page).getByRole('button', { name: 'Save changes' }).click()
    await expect(page).toHaveURL(/anna\.smith@a\.example$/)
  })

  test('FR-066 a double click sends one request', async ({ page, mockApi }) => {
    await mockApi.use('admin-rename', { delays: { renameMailbox: 1000 } })
    await openRename(page, 'anna@a.example')
    await section(page).getByLabel('New local mailbox name').fill('anna.smith')
    await section(page).getByRole('button', { name: 'Save changes' }).dblclick()
    await expect(page).toHaveURL(/anna\.smith@a\.example$/)
    expect(await renames(mockApi)).toHaveLength(1)
  })
})
