import { expect, test } from '../../fixtures/test'
import { expectFocusVisible, tabTo } from './helpers'

test('T170 edits, reorders, removes and saves app links using only the keyboard', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('app-links-three')
  await page.goto('system/customize/app-links')
  const section = page.locator('#section-app-links')
  await tabTo(page, section.getByRole('button', { name: /^Edit / }))
  await expectFocusVisible(page)
  await page.keyboard.press('Enter')
  await expect(section.getByRole('heading')).toBeFocused()
  await tabTo(page, page.locator('#app-link-2-name'))
  await expectFocusVisible(page)
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type('Keyboard app')
  await tabTo(page, page.getByRole('button', { name: 'Move up: Keyboard app', exact: true }))
  await expectFocusVisible(page)
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('button', { name: 'Move up: Keyboard app', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#app-link-0-name')).toBeFocused()
  await expect(page.locator('#app-link-0-name')).toHaveValue('Keyboard app')
  await tabTo(page, page.locator('[data-remove="2"]'))
  await expectFocusVisible(page)
  await page.keyboard.press('Enter')
  await expect(page.locator('#app-link-1-name')).toBeFocused()
  await tabTo(page, section.getByRole('button', { name: 'Save changes', exact: true }))
  await expectFocusVisible(page)
  await page.keyboard.press('Enter')
  await expect(section.locator('form')).toHaveCount(0)
  await expect(section.getByRole('heading')).toBeFocused()
  const writes = (await mockApi.requests()).filter(
    (request) => request.operationId === 'updateAppLinkSettings',
  )
  expect(writes).toHaveLength(1)
  expect(writes[0]!.body).toMatchObject({ links: [{ name: 'Keyboard app' }, { name: 'App 1' }] })
  await page.evaluate(() => scrollTo(0, 0))
  await expectAccessible()
})
