// UI 004 US4, changing and deleting domain aliases (T062): the "Edit Alias domain" form as one
// section (target and active; the name is not editable, as in legacy), the alias limit of a new
// target, the outdated flow, deactivation without a confirmation (legacy has none), and deletion
// from the list with its consequences, an outdated deletion, a temporary failure and a vanished
// alias domain.
import { ALIAS_DOMAINS_SCENARIO as AD } from '../../mocks/scenarios/alias-domains'
import { expect, test } from '../fixtures/test'
import { listReady } from '../aliases/helpers'
import { chooseTarget, entry, requestsOf, saveButton, section, trigger } from './helpers'

test.describe('domain aliases: changes and deletion', () => {
  test('US4-AS7 a new target over its alias limit is refused, and nothing changes', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('alias-domains')
    await page.goto(`alias-domains/${AD.withAliases}?edit=general`)
    await chooseTarget(page, AD.limitedTarget, section(page))
    await saveButton(page).click()
    await expect(section(page)).toContainText('Max. aliases exceeded')
    await page.goto(`alias-domains/${AD.withAliases}`)
    await expect(section(page).locator('[data-field="targetDomain"]')).toContainText(AD.target)
  })

  test('FR-039 target and active are edited, the name is not; deactivating asks nothing', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('alias-domains-admin')
    await page.goto(`alias-domains/${AD.withAliases}`)
    await section(page).getByRole('button', { name: 'Edit Edit Alias domain' }).click()
    await expect(page).toHaveURL(/\?edit=general$/)
    await expect(section(page).getByRole('textbox')).toHaveCount(0)
    await expect(section(page).getByRole('combobox', { name: 'Target domain' })).toBeVisible()
    await expectAccessible()
    await section(page).getByRole('checkbox', { name: 'Active' }).click()
    await saveButton(page).click()
    await expect(section(page).locator('[role="status"]').first()).toHaveText(
      `Changes to alias domain ${AD.withAliases} have been saved`,
    )
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    const [request] = await requestsOf(mockApi, 'updateAliasDomain')
    expect(request!.body).toEqual({ active: false })
    expect(request!.headers['if-match']).toBeTruthy()
  })

  test('FR-027 a change made elsewhere is marked, and "Save again" sends the new version', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('alias-domains-admin')
    await page.goto(`alias-domains/${AD.withAliases}?edit=general`)
    await section(page).getByRole('checkbox', { name: 'Active' }).click()
    await mockApi.patch({
      changeElsewhere: { aliasDomain: { [AD.withAliases]: { target: 'example.com' } } },
    })
    await saveButton(page).click()
    await expect(section(page).locator('[data-outdated]')).toContainText(
      'Target domain: now saved as example.com',
    )
    await section(page).getByRole('button', { name: 'Save again' }).click()
    await expect(section(page).locator('[role="status"]').first()).toBeVisible()
    const [first, second] = await requestsOf(mockApi, 'updateAliasDomain')
    expect(second!.headers['if-match']).not.toBe(first!.headers['if-match'])
    expect(second!.body).toEqual({ active: false })
  })

  test('US4-AS8 FR-029 the deletion names the aliases and what goes with them, and keeps DKIM', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('alias-domains-admin')
    await page.goto('alias-domains')
    await listReady(page)
    await trigger(page, AD.withAliases).click()
    await page.getByRole('menuitem', { name: 'Remove' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByRole('heading', { name: 'Confirm deletion' })).toBeVisible()
    await expect(dialog).toContainText(AD.withAliases)
    await expect(dialog).toContainText(`aliases (${AD.aliasCount})`)
    await expect(dialog).toContainText('DKIM key')
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await expectAccessible()
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    await expect(page.locator('[data-alert="success"]')).toHaveText(
      `Alias domain ${AD.withAliases} has been removed`,
    )
    await expect(entry(page, AD.withAliases)).toHaveCount(0)
  })

  test('FR-027 a deletion refused as outdated confirms again', async ({ page, mockApi }) => {
    await mockApi.use('alias-domains-admin')
    await page.goto('alias-domains')
    await listReady(page)
    await trigger(page, AD.withAliases).click()
    await page.getByRole('menuitem', { name: 'Remove' }).click()
    const dialog = page.getByRole('alertdialog')
    await mockApi.patch({
      changeElsewhere: { aliasDomain: { [AD.withAliases]: { active: false } } },
    })
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    await expect(dialog).toContainText('The alias domain changed in the meantime')
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    await expect(page.locator('[data-alert="success"]')).toBeVisible()
    expect(await requestsOf(mockApi, 'deleteAliasDomain')).toHaveLength(2)
  })

  test('Edge: a temporary failure on delete deletes nothing and says so', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('alias-domains-admin')
    await page.goto('alias-domains')
    await listReady(page)
    await mockApi.patch({ sharedStoreDown: true })
    await trigger(page, AD.withAliases).click()
    await page.getByRole('menuitem', { name: 'Remove' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    await expect(page.locator('[data-alert="danger"]')).toContainText('temporarily unavailable')
  })

  test('FR-028 an alias domain deleted elsewhere sends the page back to the list', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('alias-domains-admin')
    await page.goto(`alias-domains/${AD.withAliases}?edit=general`)
    await section(page).getByRole('checkbox', { name: 'Active' }).click()
    await mockApi.patch({ deleteElsewhere: { aliasDomain: [AD.withAliases] } })
    await saveButton(page).click()
    await expect(page).toHaveURL(/\/ng\/alias-domains$/)
    await expect(page.locator('[data-alert="danger"]')).toHaveText(
      'This alias domain no longer exists or is no longer available to you.',
    )
  })
})
