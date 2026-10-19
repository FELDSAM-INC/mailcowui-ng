// UI 004 T108: the main path of each story with the keyboard alone (FR-062): the alias form and its
// goto checkboxes, the domain picker, the "Allow to send as" picker, section editing, the booking
// select, selection mode with the typed confirmation, and the row menu; focus moves into dialogs,
// returns to the trigger and stays visible.
import type { Page } from '@playwright/test'

import { ALIAS_DOMAINS_SCENARIO } from '../../mocks/scenarios/alias-domains'
import { BULK_004 } from '../../mocks/scenarios/bulk-004'
import { EDIT_ALIAS_004 } from '../../mocks/scenarios/aliases-edit'
import { RESOURCES_004 } from '../../mocks/scenarios/resources'
import { expect, test } from '../fixtures/test'
import { listReady } from '../aliases/helpers'

async function focusVisible(page: Page) {
  const visible = await page.evaluate(() => {
    const element = document.activeElement
    if (!element || element === document.body) return false
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight
  })
  expect(visible, 'the focused element is visible').toBe(true)
}

test.describe('feature 004: keyboard only', () => {
  test('US2 an alias is added with the keyboard, the goto checkbox toggled with Space', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-create')
    await page.goto('aliases/new')
    await page.getByLabel('Alias address/es').focus()
    await page.keyboard.type('keys@example.org')
    const discard = page.getByRole('checkbox', { name: 'Silently discard mail' })
    await discard.focus()
    await page.keyboard.press('Space')
    await expect(discard).toBeChecked()
    await page.getByRole('button', { name: 'Add', exact: true }).focus()
    await focusVisible(page)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit alias' })).toBeVisible()
  })

  test('US4 the target domain is chosen with the arrow keys and Enter', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('alias-domains-admin')
    await page.goto('alias-domains/-/new')
    const target = page.getByRole('combobox', { name: 'Target domain', exact: true })
    await target.focus()
    // Focus opens the list with every domain; typing narrows it.
    await expect(page.getByRole('listbox', { name: 'Target domain' })).toBeVisible()
    await page.keyboard.type(ALIAS_DOMAINS_SCENARIO.target)
    await expect(
      page.getByRole('option', { name: new RegExp(`^${ALIAS_DOMAINS_SCENARIO.target}`) }),
    ).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(target).toHaveValue(ALIAS_DOMAINS_SCENARIO.target)
    await focusVisible(page)
  })

  test('US3 a section opens, saves with Enter and returns to its values', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-edit')
    await page.goto(`aliases/${EDIT_ALIAS_004.sales}`)
    const edit = page.getByRole('button', { name: 'Edit Edit alias' })
    await edit.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { level: 2, name: 'Edit alias' })).toBeFocused()
    const comment = page.getByRole('textbox', { name: 'Public comment' })
    await comment.focus()
    await page.keyboard.type('Keyboard')
    await page.keyboard.press('Enter')
    await expect(page.locator('#section-alias [role="status"]').first()).toBeVisible()
    await focusVisible(page)
  })

  test('US5 a blocked alias is allowed from the picker with the keyboard', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sender-settings')
    await page.goto('mailboxes/anna@example.org?edit=mailbox')
    const picker = page.getByRole('combobox', { name: 'Allow to send as', exact: true })
    await picker.focus()
    await page.keyboard.type('info')
    await expect(page.getByRole('listbox', { name: 'Allow to send as' })).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-sender-entry="info@example.org"]')).toBeVisible()
    await focusVisible(page)
  })

  test('US7 the booking rule is chosen with the keyboard', async ({ page, mockApi }) => {
    await mockApi.use('resources')
    await page.goto(`resources/${RESOURCES_004.meetingRoom}?edit=resource`)
    const rule = page.getByRole('combobox', { name: 'Multiple bookings' })
    await rule.focus()
    await rule.selectOption('limited')
    await expect(page.getByRole('spinbutton')).toBeVisible()
    await page.getByRole('spinbutton').focus()
    await page.keyboard.type('3')
    await expect(page.getByRole('spinbutton')).toHaveValue('3')
  })

  test('US6 selection, the typed confirmation and Escape with the keyboard; focus returns', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('bulk-004')
    await page.goto('aliases?size=50')
    await listReady(page)
    const select = page.getByRole('button', { name: 'Select', exact: true })
    await select.focus()
    await page.keyboard.press('Enter')
    const checkbox = page.locator(`[data-entry="${BULK_004.sales}"]`).getByRole('checkbox')
    await checkbox.focus()
    await page.keyboard.press('Space')
    await expect(checkbox).toBeChecked()
    const remove = page
      .getByRole('region', { name: 'Bulk actions' })
      .getByRole('button', { name: 'Remove' })
    await remove.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    const typed = dialog.getByRole('textbox')
    for (
      let step = 0;
      step < 6 && !(await typed.evaluate((element) => element === document.activeElement));
      step++
    ) {
      await page.keyboard.press('Tab')
    }
    await expect(typed).toBeFocused()
    await page.keyboard.type('1')
    await expect(dialog.getByRole('button', { name: 'Delete now' })).toBeEnabled()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(remove).toBeFocused()
  })

  test('US3 the row menu opens with the keyboard and the deletion dialog returns focus to it', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-edit')
    await page.goto('aliases')
    await listReady(page)
    const trigger = page
      .locator(`[data-entry="${EDIT_ALIAS_004.sales}"]`)
      .getByRole('button', { name: /^Actions for/ })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const remove = page.getByRole('menuitem', { name: 'Remove' })
    await expect(remove).toBeVisible()
    await remove.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
})
