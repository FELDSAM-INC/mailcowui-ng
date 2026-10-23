import { resolve } from 'node:path'
import { expect, test } from '../../fixtures/test'
const fixture = (file: string) => resolve('tests/fixtures/logos', file)
const light = '[data-logo-card="light"]'

test('T053 resetting the dark variant refreshes its preview and the active dark shell', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('settings-admin-defaults')
  await page.goto('system/customize/logos')
  await page.getByRole('switch', { name: 'Dark', exact: true }).check()
  const card = page.locator('[data-logo-card="dark"]')
  await card.getByRole('button', { name: 'Reset to default', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Inverted for dark mode')
  await expect(dialog.locator('img')).toHaveCount(1)
  await dialog.getByRole('button', { name: 'Reset to default', exact: true }).click()
  await expect(card.locator('[data-logo-default]')).toBeVisible()
  await expect(page.locator('header img, aside img')).toHaveCount(0)
  await expect(card.locator('[data-logo-current]')).toContainText('Example Mail')
  await expectAccessible()
})

test('T053 rejects raster dimensions before an upload request', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('branding-light-logo')
  await page.goto('system/customize/logos')
  const card = page.locator(light)
  await card.locator('input[type=file]').setInputFiles(fixture('too-wide.png'))
  await expect(card).toContainText('maximum image size')
  await expect(card).toContainText('1,920')
  await expect(card.locator('[data-logo-candidate]')).toHaveCount(0)
  expect(await mockApi.countRequests('replaceLogo')).toBe(0)
  await expectAccessible()
})

test('T053 stale uploads preserve the candidate and require another Upload', async ({
  page,
  context,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('branding-light-logo')
  await page.goto('system/customize/logos')
  const card = page.locator(light)
  await card.locator('input[type=file]').setInputFiles(fixture('logo.svg'))
  const other = await context.newPage()
  await other.goto('system/customize/logos')
  await other.locator(`${light} input[type=file]`).setInputFiles(fixture('logo.jpg'))
  await other.locator(light).getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(other.locator(`${light} [data-logo-candidate]`)).toHaveCount(0)
  await other.close()
  await card.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(card.locator('[data-logo-outdated]')).toBeVisible()
  await expect(card.locator('[data-logo-current]')).toContainText('image/jpeg')
  await expect(card.locator('[data-logo-candidate]')).toContainText('logo.svg')
  await expectAccessible()
  await card.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(card.locator('[data-logo-candidate]')).toHaveCount(0)
  await expect(card.locator('[data-logo-current]')).toContainText('image/svg+xml')
})

test('T053 a stale deletion asks again and shows the fresh current image', async ({
  page,
  context,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('branding-light-logo')
  await page.goto('system/customize/logos')
  const card = page.locator(light)
  await expect(card.locator('[data-logo-current]')).toContainText('image/png')
  const other = await context.newPage()
  await other.goto('system/customize/logos')
  await other.locator(`${light} input[type=file]`).setInputFiles(fixture('logo.jpg'))
  await other.locator(light).getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(other.locator(`${light} [data-logo-candidate]`)).toHaveCount(0)
  const fresh = await other.locator(`${light} [data-logo-current] img`).first().getAttribute('src')
  await other.close()
  await card.getByRole('button', { name: 'Reset to default', exact: true }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Reset to default', exact: true })
    .click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Changed elsewhere')
  await expect(dialog.locator('img')).toHaveAttribute('src', fresh!)
  await expectAccessible()
  await dialog.getByRole('button', { name: 'Reset to default', exact: true }).click()
  await expect(card.locator('[data-logo-default]')).toBeVisible()
  expect(await mockApi.countRequests('deleteLogo')).toBe(2)
})

test('T053 lowered server limits preserve the saved logo and explain the new limit', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('branding-light-logo')
  await page.goto('system/customize/logos')
  const card = page.locator(light)
  await card.locator('input[type=file]').setInputFiles(fixture('logo.jpg'))
  await expect(card.locator('[data-logo-candidate]')).toBeVisible()
  await mockApi.patch({
    settings: {
      capabilities: {
        logos: {
          maxBytes: 64,
          maxWidth: 1920,
          maxHeight: 1920,
          acceptedMediaTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'],
        },
      },
    },
  })
  await card.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(card).toContainText('64 B')
  await expect(card.locator('[data-logo-current]')).toContainText('image/png')
  await expect(card.getByRole('button', { name: 'Upload', exact: true })).toBeDisabled()
  await expectAccessible()
})

test('T053 stored legacy SVG is only an image and read failures can be retried', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('branding-legacy-unsafe-svg')
  await mockApi.failNext('getLogoSetting', { status: 503 })
  await page.goto('system/customize/logos')
  await page.locator('main').getByRole('button', { name: 'Try again', exact: true }).click()
  const card = page.locator(light)
  await expect(card.locator('[data-logo-current] img')).toHaveCount(2)
  await expect(card.locator('script, object, iframe, embed')).toHaveCount(0)
  expect(await page.evaluate(() => 'logoExecuted' in window)).toBe(false)
  await expectAccessible()
})

test('T053 previews a content-detected PNG on its matching surface and updates the shell after upload', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('branding-light-logo')
  await page.goto('system/customize/logos')
  const card = page.locator(light)
  await card.locator('input[type=file]').setInputFiles(fixture('logo-300x80.png'))
  await expect(card.locator('[data-logo-candidate]')).toContainText('logo-300x80.png')
  await expect(card.locator('[data-logo-candidate] img')).toHaveCount(2)
  expect(await mockApi.countRequests('replaceLogo')).toBe(0)
  await expectAccessible()
  await expectNoHorizontalScroll(page, { widths: [320, 360] })
  await card.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(card.locator('[data-logo-candidate]')).toHaveCount(0)
  await expect(card.locator('[role=status]')).toContainText(/upload/i)
  await expect(card).toContainText('image/png')
  const stored = await card.locator('[data-logo-current] img').first().getAttribute('src')
  expect(stored).toMatch(/\/api\/v2\/public-config\/logos\/light\?v=/)
  await expect(page.locator('header img, aside img').first()).toHaveAttribute('src', stored!)
})

test('T053 refuses a renamed PDF and over-limit content before upload, and reports an API SVG refusal', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('branding-light-logo')
  await page.goto('system/customize/logos')
  const card = page.locator(light),
    input = card.locator('input[type=file]')
  await input.setInputFiles(fixture('pdf-named-logo.png'))
  await expect(card).toContainText('Invalid mime type')
  expect(await mockApi.countRequests('replaceLogo')).toBe(0)
  await input.setInputFiles({
    name: 'large.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(15 * 1024 * 1024 + 1),
  })
  await expect(card).toContainText('maximum file size')
  await expect(card).toContainText('15 MiB')
  expect(await mockApi.countRequests('replaceLogo')).toBe(0)
  await input.setInputFiles(fixture('logo-script.svg'))
  await card.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(card).toContainText('script element')
  await expect(card.locator('[data-logo-current]')).toContainText('image/png')
  expect(await page.evaluate(() => 'logoExecuted' in window)).toBe(false)
  await expectAccessible()
})

for (const file of ['logo.jpg', 'logo-animated.gif', 'logo-no-size.svg'])
  test(`T053 accepts ${file} and describes stored dimensions`, async ({ page, mockApi }) => {
    await mockApi.use('branding-light-logo')
    await page.goto('system/customize/logos')
    const card = page.locator(light)
    await card.locator('input[type=file]').setInputFiles(fixture(file))
    await card.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(card.locator('[data-logo-candidate]')).toHaveCount(0)
    await expect(card.locator('[data-logo-current]')).toContainText(
      file.endsWith('.svg') ? 'No declared size' : file.endsWith('.jpg') ? '200 × 60' : '120 × 40',
    )
  })

test('T053 confirms reset with current image, restores the default, and keeps the page accessible', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('branding-light-logo')
  await page.goto('system/customize/logos')
  const card = page.locator(light)
  await card.getByRole('button', { name: 'Reset to default', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Normal')
  await expect(dialog.locator('img')).toHaveCount(1)
  await expectAccessible()
  await dialog.getByRole('button', { name: 'Reset to default', exact: true }).click()
  await expect(card.locator('[data-logo-default]')).toBeVisible()
  await expect(page.locator('header, aside').first()).toContainText('Example Mail')
})

test('T053 demo mode and direct domain-admin access respect the capabilities boundary', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('settings-demo-mode')
  await page.goto('system/customize/logos')
  await expect(page.locator(light).locator('input[type=file]')).toBeDisabled()
  await expect(page.getByRole('main')).toContainText(/demo/i)
  await mockApi.use('settings-domain-admin')
  await page.goto('system/customize/logos')
  await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
  expect(await mockApi.countRequests('getLogoSetting')).toBe(0)
})
