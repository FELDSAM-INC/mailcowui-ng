import { expect, test } from '../../fixtures/test'
for (const scenario of ['filters-many', 'filters-domain-admin'])
  test(`T108 ${scenario} offers eight translated Sieve examples and preserves metadata`, async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use(scenario)
    await page.goto('mailboxes/anna@example.org/filters/new')
    await expect(page.locator('[data-preset]')).toHaveCount(8)
    await page.locator('[data-preset="sieve_1"] button').click()
    await expect(page.locator('#filter-description')).toHaveValue(
      'Discard mail with probable dangerous file types',
    )
    await expect(page.locator('#filter-script')).toHaveValue(/require/)
    await page.locator('#filter-description').fill('Keep my description')
    await page.getByRole('combobox', { name: /^Filter type/ }).selectOption('postfilter')
    await page.locator('[data-preset="sieve_8"] button').click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Replace editor content?')
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(page.locator('#filter-description')).toHaveValue('Keep my description')
    await expect(page.getByRole('combobox', { name: /^Filter type/ })).toHaveValue('postfilter')
    await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeDisabled()
    await expect(page.locator('[data-code-editor]')).toBeVisible()
    for (const button of await page.locator('[data-preset] > button').all()) {
      const bounds = await button.boundingBox()
      expect(bounds?.height).toBeGreaterThanOrEqual(44)
    }
    // Inserting the last example scrolls an unrelated button under the sticky header.
    // Check the whole page from the top so axe measures complete targets.
    await page.evaluate(() => window.scrollTo(0, 0))
    await expectAccessible()
    await expectNoHorizontalScroll()
  })

test('T108 a domain administrator without the filters flag cannot reach preset-enabled creation', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('filters-domain-admin-no-flag')
  await page.goto('filters/new')
  await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
  await expect(page.locator('[data-preset-picker]')).toHaveCount(0)
  expect(await mockApi.countRequests('listPresets')).toBe(0)
})
