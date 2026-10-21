import type { Page } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import { openNavigation } from '../../fixtures/flows'

test.setTimeout(90_000)

const effective = {
  light: { color: '#1d4ed8', foreground: '#ffffff' as const },
  dark: { color: '#60a5fa', foreground: '#000000' as const },
}
async function theme(page: Page, dark: boolean) {
  await page.evaluate((dark) => {
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, dark)
  await page.mouse.move(0, 0)
}

test('T068 saving applies colours to the real shell and a new browser context reads them', async ({
  page,
  context,
  browser,
  baseURL,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('brand-colours-none')
  await page.goto('system/customize/colours')
  const section = page.locator('#section-brand-colours')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#brand-colour-light').fill('#1d4ed8')
  await page.locator('#brand-colour-dark').fill('#60a5fa')
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('form')).toHaveCount(0)
  await section.getByRole('button', { name: /^Edit / }).click()
  const save = section.getByRole('button', { name: 'Save changes', exact: true })
  for (const [dark, background, foreground] of [
    [false, 'rgb(29, 78, 216)', 'rgb(255, 255, 255)'],
    [true, 'rgb(96, 165, 250)', 'rgb(0, 0, 0)'],
  ] as const) {
    await theme(page, dark)
    await expect(save).toHaveCSS('background-color', background)
    await expect(save).toHaveCSS('color', foreground)
    const nav = await openNavigation(page)
    await expect(nav.locator('[aria-current=page]')).toHaveCSS('background-color', background)
    await expect(nav.locator('[aria-current=page]')).toHaveCSS('color', foreground)
    if (await page.getByRole('dialog').count()) await page.keyboard.press('Escape')
  }
  await expectAccessible()
  await section.getByRole('button', { name: 'Cancel', exact: true }).click()
  const fresh = await browser.newContext({
    baseURL,
    storageState: await context.storageState(),
    viewport: page.viewportSize()!,
  })
  try {
    const other = await fresh.newPage()
    await other.goto('system/customize/colours')
    await expect(other.locator('#section-brand-colours')).toContainText('#1d4ed8')
    expect(
      await other.locator('html').evaluate((node) => node.style.getPropertyValue('--brand-dark')),
    ).toBe('#60a5fa')
  } finally {
    await fresh.close()
  }
  await mockApi.use('templates', { publicConfig: { brandColors: effective } })
  await page.goto('domain-templates/3')
  const link = page.locator('main .text-link, main .text-accent-text').first()
  await expect(link).toBeVisible()
  for (const [dark, colour] of [
    [false, 'rgb(29, 78, 216)'],
    [true, 'rgb(96, 165, 250)'],
  ] as const) {
    await theme(page, dark)
    await expect(link).toHaveCSS('color', colour)
  }
  await expectAccessible()
  await mockApi.use('quarantine-admin', { publicConfig: { brandColors: effective } })
  await page.goto('quarantine/6')
  const attachment = page.locator('[data-attachment-download]').first()
  const lookup = page.locator('[data-hash-lookup]').first()
  await expect(attachment).toBeVisible()
  for (const [dark, colour] of [
    [false, 'rgb(29, 78, 216)'],
    [true, 'rgb(96, 165, 250)'],
  ] as const) {
    await theme(page, dark)
    await expect(attachment).toHaveCSS('color', colour)
    await expect(lookup).toHaveCSS('color', colour)
  }
  await expectAccessible()
})

test('T068 clearing colours restores defaults while focus and status colours stay unchanged', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('brand-colours-set')
  await page.goto('system/customize/colours')
  const section = page.locator('#section-brand-colours')
  await section.getByRole('button', { name: /^Edit / }).click()
  const snapshot = () =>
    page.locator('html').evaluate((node) => {
      const style = getComputedStyle(node)
      return [
        '--color-focus',
        '--color-success-500',
        '--color-warning-500',
        '--color-error-500',
        '--color-blue-500',
      ].map((key) => style.getPropertyValue(key))
    })
  await theme(page, false)
  const before = await snapshot()
  await page.locator('#brand-colour-light').fill('')
  await page.locator('#brand-colour-dark').fill('')
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('form')).toHaveCount(0)
  expect(await snapshot()).toEqual(before)
  await section.getByRole('button', { name: /^Edit / }).click()
  await theme(page, false)
  await expect(section.getByRole('button', { name: 'Save changes', exact: true })).toHaveCSS(
    'background-color',
    'rgb(24, 121, 78)',
  )
  expect(
    await page.locator('html').evaluate((node) => node.style.getPropertyValue('--brand-light')),
  ).toBe('')
  expect(
    await page.locator('html').evaluate((node) => node.style.getPropertyValue('--brand-dark')),
  ).toBe('')
  await expectAccessible()
})

test('T068 saved accents reach actual checked switches, native checkboxes and radios', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('admins-three', { publicConfig: { brandColors: effective } })
  await page.goto('administrators/admins/-/new')
  const control = page.locator('[data-slot=switch][aria-checked=true]').first()
  await expect(control).toBeVisible()
  for (const [dark, colour, foreground] of [
    [false, 'rgb(29, 78, 216)', 'rgb(255, 255, 255)'],
    [true, 'rgb(96, 165, 250)', 'rgb(0, 0, 0)'],
  ] as const) {
    await theme(page, dark)
    await expect(control).toHaveCSS('background-color', colour)
    await expect(control.locator('[data-slot=switch-thumb]')).toHaveCSS(
      'background-color',
      foreground,
    )
  }
  await expectAccessible()
  await mockApi.use('domains-60', { publicConfig: { brandColors: effective } })
  await page.goto('domains')
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  const checkbox = page.getByRole('checkbox', { name: 'Select all on this page' })
  await checkbox.check()
  await theme(page, false)
  await expect(checkbox).toHaveCSS('accent-color', 'rgb(29, 78, 216)')
  await theme(page, true)
  await expect(checkbox).toHaveCSS('accent-color', 'rgb(96, 165, 250)')
  await mockApi.use('dns-admin', { publicConfig: { brandColors: effective } })
  await page.goto('dns/dkim-keys/example.org')
  const radio = page.getByRole('radio', { checked: true })
  await expect(radio).toBeVisible()
  await theme(page, false)
  await expect(radio).toHaveCSS('background-color', 'rgb(29, 78, 216)')
  await theme(page, true)
  await expect(radio).toHaveCSS('background-color', 'rgb(96, 165, 250)')
  await expect(radio.locator('[data-slot=radio-group-indicator] span')).toHaveCSS(
    'background-color',
    'rgb(0, 0, 0)',
  )
  await expectAccessible()
})

test('T068 a public configuration without brandColors retains the built-in palette', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('settings-admin-defaults')
  await page.route('**/api/v2/public-config', async (route) => {
    const response = await route.fetch(),
      body = await response.json()
    delete body.data.brandColors
    await route.fulfill({ response, json: body })
  })
  await page.goto('system/customize/colours')
  await page
    .locator('#section-brand-colours')
    .getByRole('button', { name: /^Edit / })
    .click()
  await theme(page, false)
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toHaveCSS(
    'background-color',
    'rgb(24, 121, 78)',
  )
  expect(
    await page.locator('html').evaluate((node) => node.style.getPropertyValue('--brand-light')),
  ).toBe('')
  await expectAccessible()
})
