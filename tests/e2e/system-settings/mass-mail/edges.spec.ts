import { expect, test } from '../../fixtures/test'
import { setPageVisibility } from '../../fixtures/visibility'
import { mockMassMailJob } from '../../../mocks/factories/mass-mail'

const jobPath = 'system/mass-mail/jobs/01JQ0000000000000000000001'

test('refresh pauses while hidden, resumes once, and leaving never cancels delivery', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('mass-mail-running')
  await page.clock.install()
  await page.goto(jobPath)
  await expect(page.locator('[data-job-status]')).toHaveText('Running')
  await setPageVisibility(page, 'hidden')
  const reads = await mockApi.countRequests('getMassMailJob')
  await page.clock.runFor(20_000)
  expect(await mockApi.countRequests('getMassMailJob')).toBe(reads)
  await setPageVisibility(page, 'visible')
  await expect.poll(() => mockApi.countRequests('getMassMailJob')).toBe(reads + 1)
  await page.getByRole('link', { name: 'Mass mail jobs', exact: true }).last().click()
  const left = await mockApi.countRequests('getMassMailJob')
  await page.clock.runFor(15_000)
  expect(await mockApi.countRequests('getMassMailJob')).toBe(left)
  expect(await mockApi.countRequests('cancelMassMailJob')).toBe(0)
})

test('inactivity stays paused through interaction; manual refresh works and Resume restarts polling', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('mass-mail-running', { idleTimeout: 300 })
  await page.clock.install()
  await page.goto(jobPath)
  await expect(page.locator('[data-job-status]')).toHaveText('Running')
  await page.clock.runFor(301_000)
  await expect(
    page.getByText('Automatic refresh paused because of inactivity. Resume when you return.', {
      exact: true,
    }),
  ).toBeVisible()
  const reads = await mockApi.countRequests('getMassMailJob')
  await page.keyboard.press('Tab')
  await page.clock.runFor(10_000)
  expect(await mockApi.countRequests('getMassMailJob')).toBe(reads)
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect.poll(() => mockApi.countRequests('getMassMailJob')).toBe(reads + 1)
  await page.clock.runFor(10_000)
  expect(await mockApi.countRequests('getMassMailJob')).toBe(reads + 1)
  await page.getByRole('button', { name: 'Resume automatic refresh' }).click()
  await expect.poll(() => mockApi.countRequests('getMassMailJob')).toBe(reads + 2)
  await page.clock.runFor(5_500)
  await expect.poll(() => mockApi.countRequests('getMassMailJob')).toBe(reads + 3)
})

test('cancelling a job completed elsewhere reports completion and refreshes final counts', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('mass-mail-running')
  await page.goto(jobPath)
  await page.getByRole('button', { name: 'Pause automatic refresh' }).click()
  await page.getByRole('button', { name: 'Cancel delivery', exact: true }).click()
  await mockApi.patch({
    massMail: {
      jobs: [
        mockMassMailJob({
          status: 'completed',
          counts: { delivered: 120, pending: 0, failed: 0, skipped: 0 },
          finishedAt: '2026-10-20T08:05:00Z',
        }),
      ],
    },
  })
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Cancel delivery', exact: true })
    .click()
  await expect(page.locator('[data-job-status]')).toHaveText('Completed')
  await expect(
    page.getByText('This job already completed. Its final results are shown below.', {
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel delivery', exact: true })).toHaveCount(0)
})

test('unknown job offers a back link; list and recipient filters survive history navigation', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('mass-mail-completed')
  await page.goto('system/mass-mail/jobs/01JQ0000000000000000000999')
  await expect(page.getByRole('main')).toContainText('This item could not be found.')
  await page.getByRole('link', { name: 'Mass mail jobs', exact: true }).last().click()
  await page.getByLabel('Search subjects').fill('Missing')
  await expect(page).toHaveURL(/q=Missing/)
  await expect(page.locator('[data-jobs-empty]')).toBeVisible()
  await page.getByLabel('Search subjects').fill('Maintenance')
  await expect(
    page.locator('[data-job-list]').getByRole('link', { name: 'Maintenance', exact: true }),
  ).toBeVisible()
  await page.getByLabel('Job status').selectOption('completed')
  await expect(page).toHaveURL(/status=completed/)
  await page
    .locator('[data-job-list]')
    .getByRole('link', { name: 'Maintenance', exact: true })
    .click()
  await page.getByLabel('Recipient outcome').selectOption('failed')
  await page.getByLabel('Search recipients').fill('user001@')
  await expect(page.locator('[data-job-recipient]')).toHaveCount(1)
  await expect(page).toHaveURL((url) => url.searchParams.get('q') === 'user001@')
  await page.goBack()
  await expect(page.getByLabel('Recipient outcome')).toHaveValue('')
  await expect(page.getByLabel('Search recipients')).toHaveValue('')
})
