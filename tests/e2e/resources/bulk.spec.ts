// UI 004 US7 with US6-AS3, mass actions on resources (T094): five desks deleted after typing 5, with
// their names and the groupware data named; activate and deactivate.
import { RESOURCES_004 } from '../../mocks/scenarios/resources'
import { expect, test } from '../fixtures/test'
import type { Page } from '@playwright/test'
import { listReady } from '../aliases/helpers'
import { entry } from './helpers'

const bar = (page: Page) => page.getByRole('region', { name: 'Bulk actions' })

test.describe('resources: mass actions', () => {
  test('US6-AS3 five resources are deleted only after "5" is typed', async ({ page, mockApi }) => {
    await mockApi.use('resources')
    await page.goto('resources')
    await listReady(page)
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    for (const desk of RESOURCES_004.desks) await entry(page, desk).getByRole('checkbox').click()
    await bar(page).getByRole('button', { name: 'Remove' }).click()
    const dialog = page.getByRole('alertdialog')
    for (const desk of RESOURCES_004.desks) await expect(dialog).toContainText(desk)
    await expect(dialog).toContainText('calendar')
    await expect(dialog.getByRole('button', { name: 'Delete now' })).toBeDisabled()
    await dialog.getByRole('textbox', { name: 'Type 5 to confirm' }).fill('5')
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    await expect(page.locator('[data-bulk-summary]')).toContainText('5 done')
    for (const desk of RESOURCES_004.desks) await expect(entry(page, desk)).toHaveCount(0)
  })

  test('FR-057 FR-058 deactivate asks once; activate runs at once', async ({ page, mockApi }) => {
    await mockApi.use('resources')
    await page.goto('resources')
    await listReady(page)
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await entry(page, RESOURCES_004.desks[0]).getByRole('checkbox').click()
    await bar(page).getByRole('button', { name: 'Deactivate' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Deactivate' }).click()
    await expect(page.locator('[data-bulk-summary]')).toContainText('1 done')
    await entry(page, RESOURCES_004.desks[0]).getByRole('checkbox').click()
    await bar(page).getByRole('button', { name: 'Activate', exact: true }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page.locator('[data-bulk-summary]')).toContainText(
      `Changes to mailbox ${RESOURCES_004.desks[0]} have been saved`,
    )
  })
})
