// UI 008 US3 editing a sync job (T049): the classic edit page as one section with its own save, in
// legacy order; the write-only password; only changed fields sent with the loaded version; an
// outdated save that keeps the input and lists the changes; the leave guard; field errors, an
// existing job, the custom-parameter restriction, the running note and a job gone meanwhile.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { requestsOf } from './helpers'

const EDIT = { name: 'Edit Edit sync job' }

async function openEdit(page: Page, id = 2) {
  await page.goto(`sync-jobs/${id}`)
  await page.getByRole('button', EDIT).click()
  await expect(page).toHaveURL(/edit=syncjob/)
}

test.describe('editing a sync job', () => {
  test('US3-AS1 FR-030 the form shows the stored values and an empty password with its hint', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await openEdit(page)
    await expect(page.getByLabel('Hostname')).toHaveValue('mail.previous.example')
    await expect(page.getByLabel('Port')).toHaveValue('993')
    await expect(page.getByLabel('Username')).toHaveValue('alice')
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
    await expect(
      page.getByText('A password is saved. Leave the field empty to keep it.'),
    ).toBeVisible()
    await expect(page.getByLabel('Encryption')).toHaveValue('ssl')
    await expect(page.getByText('1-43800')).toBeVisible()
    await expect(page.getByLabel('Simulate synchronization (--dry)')).not.toBeChecked()
    await expect(page.getByLabel('Active')).toBeChecked()
    await expectAccessible()
    await expectNoHorizontalScroll()
    await mockApi.patch({ syncJobs: { changeElsewhere: { id: 3, remotePassword: '' } } })
    await openEdit(page, 3)
    await expect(page.getByText('No password is saved.')).toBeVisible()
  })

  test('US3-AS2 FR-026 FR-028 only the interval is sent with If-Match; an unchanged save sends nothing', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await openEdit(page)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).not.toHaveURL(/edit=/)
    expect(await requestsOf(mockApi, 'updateSyncJob')).toEqual([])
    const etag = (await page.request.get('/api/v2/sync-jobs/2').then((r) => r.json())) as {
      data: { etag: string }
    }
    await openEdit(page)
    await page.getByLabel('Interval (min)').fill('45')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(
      page
        .locator('#section-syncjob')
        .getByText('Changes to mailbox alice@example.org have been saved'),
    ).toBeVisible()
    await expect(page.locator('[data-section-values]')).toContainText('45')
    const [request] = await requestsOf(mockApi, 'updateSyncJob')
    expect(request!.body).toEqual({ intervalMinutes: 45 })
    expect(request!.headers['if-match']).toBe(etag.data.etag)
  })

  test('US3-AS3 a new password is sent once and the field is empty again', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await openEdit(page)
    await page.getByLabel('Password', { exact: true }).fill('New-Remote-Secret')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).not.toHaveURL(/edit=/)
    const [request] = await requestsOf(mockApi, 'updateSyncJob')
    expect(request!.body).toEqual({ remotePassword: 'New-Remote-Secret' })
    await page.getByRole('button', EDIT).click()
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
  })

  test('US3-AS4 FR-020 the owner has no edit control and no patch names it', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await openEdit(page)
    await expect(page.getByLabel('Owner')).toHaveCount(0)
    await page.getByLabel('Exclude objects (regex)').fill('(?i)trash')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).not.toHaveURL(/edit=/)
    for (const request of await requestsOf(mockApi, 'updateSyncJob')) {
      expect(request.body).not.toHaveProperty('mailbox')
    }
  })

  test('US3-AS5 FR-026 an outdated save keeps the input, lists the change and saves again', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await openEdit(page)
    await page.getByLabel('Exclude objects (regex)').fill('(?i)trash')
    await mockApi.patch({ syncJobs: { changeElsewhere: { id: 2, intervalMinutes: 45 } } })
    await page.getByRole('button', { name: 'Save changes' }).click()
    const notice = page.locator('[data-outdated]')
    await expect(notice).toContainText('Changed elsewhere')
    await expect(notice).toContainText('Interval (min): now saved as 45')
    await expect(page.getByLabel('Exclude objects (regex)')).toHaveValue('(?i)trash')
    await expect(page.getByRole('button', { name: /overwrite/i })).toHaveCount(0)
    await expectAccessible()
    await page.getByRole('button', { name: 'Save again' }).click()
    await expect(page).not.toHaveURL(/edit=/)
    const requests = await requestsOf(mockApi, 'updateSyncJob')
    expect(requests.map((r) => r.status)).toEqual([412, 200])
    expect(requests[1]!.body).toEqual({ exclude: '(?i)trash' })

    await openEdit(page)
    await page.getByLabel('Hostname').fill('imap.other.example')
    await mockApi.patch({ syncJobs: { changeElsewhere: { id: 2, intervalMinutes: 50 } } })
    await page.getByRole('button', { name: 'Save changes' }).click()
    await page.getByRole('button', { name: 'Discard my changes' }).click()
    await expect(page.getByLabel('Hostname')).toHaveValue('mail.previous.example')
    await expect(page.getByLabel('Interval (min)')).toHaveValue('50')
  })

  test('US3-AS6 FR-027 leaving with changes asks; Cancel discards the input', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await openEdit(page)
    await page.getByLabel('Hostname').fill('imap.leaving.example')
    await page.goBack()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Leave without saving?')
    await dialog.getByRole('button', { name: 'Stay' }).click()
    await expect(page.getByLabel('Hostname')).toHaveValue('imap.leaving.example')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page).not.toHaveURL(/edit=/)
    await expect(page.locator('[data-section-values]')).toContainText('mail.previous.example')
  })

  test('the section opens in place on desktop and alone at 360 px; a reload keeps it open', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await openEdit(page)
    const narrow = (page.viewportSize()?.width ?? 0) < 768
    await expect(page.locator('#section-syncjob')).toHaveAttribute(
      'data-layout',
      narrow ? 'full' : 'inline',
    )
    await expect(page.locator('[data-run-status]')).toHaveCount(narrow ? 0 : 1)
    await page.reload()
    await expect(page.getByLabel('Hostname')).toHaveValue('mail.previous.example')
  })

  test('FR-022 FR-023 field errors, an existing job, and the restricted custom parameters', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await openEdit(page)
    await page.getByLabel('Exclude objects (regex)').fill('(junk')
    await page.getByLabel('Custom parameters').fill('--showpasswords')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.locator('#syncjob-exclude-error')).toHaveText(
      'Error: This is not a valid regular expression.',
    )
    await expect(page.locator('#syncjob-customParameters-error')).toHaveText(
      'Error: The option --showpasswords is not allowed on this server.',
    )
    await page.getByLabel('Exclude objects (regex)').fill('(?i)spam|(?i)junk')
    await page.getByLabel('Custom parameters').fill('')
    await page.getByLabel('Hostname').fill('imap.old-mail.example')
    await page.getByLabel('Username').fill('alice.old')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(
      page.getByText('Object imap.old-mail.example / alice.old already exists'),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Open the existing job' }).click()
    // The form still holds the unsaved input, so leaving asks first.
    await page.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click()
    await expect(page).toHaveURL(/sync-jobs\/1$/)

    await mockApi.use('sync-jobs-user-restricted-params')
    await openEdit(page, 1)
    const params = page.getByLabel('Custom parameters')
    await expect(params).toHaveAttribute('readonly', '')
    await expect(
      page.getByText('Only administrators may set custom parameters on this server.'),
    ).toBeVisible()
    await page.getByLabel('Simulate synchronization (--dry)').check()
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).not.toHaveURL(/edit=/)
    const [request] = await requestsOf(mockApi, 'updateSyncJob')
    expect(request!.body).toEqual({ dryRun: true })
  })

  test('FR-038 saving a running job says the run finishes on its own; a job gone shows it', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await openEdit(page, 4)
    await page.getByLabel('Interval (min)').fill('31')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(
      page
        .locator('#section-syncjob')
        .getByText('The run in progress is not interrupted and finishes on its own.'),
    ).toBeVisible()
    await openEdit(page, 2)
    await mockApi.patch({ syncJobs: { delete: 2 } })
    await page.getByLabel('Interval (min)').fill('32')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('This sync job no longer exists.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to the sync jobs' })).toBeVisible()
  })
})
