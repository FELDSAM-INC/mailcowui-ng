// UI 008 US1 the job page in read mode (T025): the classic edit page's heading with the job label,
// the run status with the list's keys, the stored values in the edit page's order with its labels
// and option names, the History action for administrators, and no password anywhere.
import { expect, test } from '../fixtures/test'

test.describe('sync job page', () => {
  test('FR-015 the heading, the run status and every stored value in the classic order', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs/2')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit sync job' })).toBeVisible()
    await expect(page.getByText('alice@mail.previous.example:993').first()).toBeVisible()
    const status = page.locator('[data-run-status]')
    await expect(status).toContainText('Owner')
    await expect(status).toContainText('alice@example.org')
    await expect(status).toContainText('Last run result')
    await expect(status).toContainText('Wrong username or password')
    await expect(status).toContainText('Waiting')
    const values = page.locator('[data-section-values]')
    const labels = await values.locator('dt').allTextContents()
    expect(labels.map((label) => label.trim())).toEqual([
      'Hostname',
      'Port',
      'Username',
      'Password',
      'Encryption',
      'Interval (min)',
      'Sync into subfolder on destination(empty = do not use subfolder)',
      'Maximum age of messages in days that will be polled from remote(0 = ignore age)',
      'Max. bytes per second (0 = unlimited)',
      'Timeout for connection to remote host',
      'Timeout for connection to local host',
      'Exclude objects (regex)',
      'Custom parameters',
      'Delete duplicates on destination (--delete2duplicates)',
      'Delete from source when completed (--delete1)',
      'Delete messages on destination that are not on source (--delete2)',
      'Try to automap folders ("Sent items", "Sent" => "Sent" etc.) (--automap)',
      'Skip duplicate messages across folders (first come, first serve) (--skipcrossduplicates)',
      'Subscribe all folders (--subscribeall)',
      'Simulate synchronization (--dry)',
      'Active',
    ])
    await expect(values).toContainText('mail.previous.example')
    await expect(values).toContainText('SSL')
    await expect(values).toContainText('(?i)spam|(?i)junk')
    await expect(values).toContainText('✓')
    await expect(values).toContainText('✕')
    await expectAccessible()
    await expectNoHorizontalScroll()
  })

  test('FR-020 FR-029 the owner is not editable and no password value is on the page', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs/2')
    await expect(page.getByText('A password is saved.')).toBeVisible()
    expect(await page.content()).not.toContain('remote-secret-2')
    await expect(page.getByRole('button', { name: /^Edit Owner/ })).toHaveCount(0)
    await mockApi.patch({ syncJobs: { changeElsewhere: { id: 2, remotePassword: '' } } })
    await page.reload()
    await expect(page.getByText('No password is saved.')).toBeVisible()
  })

  test('FR-015 administrators open the History; domain administrators and users do not see it', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs/2')
    const history = page.getByRole('link', { name: 'History' })
    await expect(history).toHaveAttribute('href', /audit-log\?targetType=syncJob&targetId=2$/)
    for (const scenario of ['sync-jobs-domain-admin', 'sync-jobs-user']) {
      await mockApi.use(scenario)
      await page.goto('sync-jobs/2')
      await expect(page.getByRole('heading', { level: 1, name: 'Edit sync job' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'History' })).toHaveCount(0)
    }
  })

  test('the mailbox user sees the run status with the user table\'s keys and no owner', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('sync-jobs-user')
    await page.goto('sync-jobs/1')
    const status = page.locator('[data-run-status]')
    await expect(status).toContainText('Last run')
    await expect(status).not.toContainText('Owner')
    await expectAccessible()
  })
})
