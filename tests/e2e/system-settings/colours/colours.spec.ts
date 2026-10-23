import { expect, test } from '../../fixtures/test'

test('T067 normalises colours, explains contrast and saves the two themes', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('brand-colours-none')
  await page.goto('system/customize/colours')
  const section = page.locator('#section-brand-colours')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#brand-colour-light').fill('1D4ED8')
  await page.locator('#brand-colour-dark').focus()
  await expect(page.locator('#brand-colour-light')).toHaveValue('#1d4ed8')
  const light = page.locator('[data-brand-preview=light]'),
    dark = page.locator('[data-brand-preview=dark]')
  await expect(light).toContainText('6.7:1 (minimum 4.5:1)')
  await expect(light).toContainText('Passes.')
  await expect(dark).toContainText('6.7:1')
  await expect(dark).toContainText('dark theme uses the light theme colour')
  await page.locator('#brand-colour-dark').fill('#60A5FA')
  await expect(dark).toContainText('8.3:1')
  await expect(light.locator('[data-preview-button]')).toHaveCSS('color', 'rgb(255, 255, 255)')
  await expect(dark.locator('[data-preview-button]')).toHaveCSS('color', 'rgb(0, 0, 0)')
  await expect(page.locator('main')).toContainText('classic interface keeps its own palette')
  await expectAccessible()
  await expectNoHorizontalScroll(page, { widths: [320, 360] })
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('form')).toHaveCount(0)
  const writes = (await mockApi.requests()).filter((r) => r.operationId === 'updateBrandColors')
  expect(writes).toHaveLength(1)
  expect(writes[0]!.body).toEqual({ light: '#1d4ed8', dark: '#60a5fa' })
  expect(writes[0]!.headers['if-match']).toMatch(/^"/)
  await expectAccessible()
})

test('T067 rejects shorthand, preserves bright accents, and syncs the picker', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('brand-colours-none')
  await page.goto('system/customize/colours')
  const section = page.locator('#section-brand-colours')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#brand-colour-light').fill('#abc')
  await expect(page.locator('#brand-colour-light')).toHaveAttribute('aria-invalid', 'true')
  await expect(section.getByRole('button', { name: 'Save changes', exact: true })).toHaveCount(0)
  await page.locator('#brand-colour-light').fill('#FEBC23')
  await expect(section).toContainText('12.4:1')
  await expect(section.locator('[data-adjust-colour]')).toHaveCount(0)
  await expect(page.locator('#brand-colour-light')).not.toHaveAttribute('aria-invalid', 'true')
  await expect(section.getByRole('button', { name: 'Save changes', exact: true })).toBeEnabled()
  await page.locator('#brand-colour-light-picker').evaluate((input) => {
    ;(input as HTMLInputElement).value = '#1d4ed8'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect(page.locator('#brand-colour-light')).toHaveValue('#1d4ed8')
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('form')).toHaveCount(0)
  expect(await mockApi.countRequests('updateBrandColors')).toBe(1)
  await expectAccessible()
})

test('T067 shows an older API contrast refusal on the field without losing the draft', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('brand-colours-none')
  await page.goto('system/customize/colours')
  const section = page.locator('#section-brand-colours')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#brand-colour-light').fill('#1d4ed8')
  await mockApi.patch({
    failures: {
      updateBrandColors: {
        status: 422,
        type: 'validation-failed',
        times: 1,
        errors: {
          light: [
            {
              code: 'insufficientContrast',
              message: 'Insufficient contrast',
              params: { ratio: 4.42, minimum: 4.5, surface: '#ffffff' },
            },
          ],
        },
      },
    },
  })
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('#brand-colour-light')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('#brand-colour-light-error')).toContainText('4.42')
  await expect(page.locator('#brand-colour-light-error')).toContainText('4.5')
  await expect(page.locator('#brand-colour-light-error')).toContainText('#ffffff')
  await expect(page.locator('#brand-colour-light')).toHaveValue('#1d4ed8')
  await expectAccessible()
})

test('T067 retains edits through stale version and requires an explicit retry', async ({
  page,
  context,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('brand-colours-none')
  await page.goto('system/customize/colours')
  const section = page.locator('#section-brand-colours')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#brand-colour-light').fill('#1d4ed8')
  const other = await context.newPage()
  await other.goto('system/customize/colours')
  await other
    .locator('#section-brand-colours')
    .getByRole('button', { name: /^Edit / })
    .click()
  await other.locator('#brand-colour-light').fill('#0f766e')
  await other.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(other.locator('#section-brand-colours form')).toHaveCount(0)
  await other.close()
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('[data-outdated]')).toContainText('#0f766e')
  await expect(page.locator('#brand-colour-light')).toHaveValue('#1d4ed8')
  await expectAccessible()
  await section.getByRole('button', { name: 'Save again', exact: true }).click()
  await expect(section.locator('form')).toHaveCount(0)
  await expect(section).toContainText('#1d4ed8')
})

test('T067 temporary failure retains draft and a pending save sends only once', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('brand-colours-none')
  await page.goto('system/customize/colours')
  const section = page.locator('#section-brand-colours')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#brand-colour-dark').fill('#60a5fa')
  await mockApi.failNext('updateBrandColors', { status: 503 })
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('[role=alert]')).toBeVisible()
  await expect(page.locator('#brand-colour-dark')).toHaveValue('#60a5fa')
  await expectAccessible()
  await mockApi.delay('updateBrandColors', 700)
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled()
  await expect(section.locator('form')).toHaveCount(0)
  expect(await mockApi.countRequests('updateBrandColors')).toBe(2)
})

test('T067 demo mode is read-only and dark inheritance is explained', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('brand-colours-light-only')
  await mockApi.patch({ settings: { capabilities: { demoMode: true } } })
  await page.goto('system/customize/colours')
  await expect(page.locator('[data-demo-mode]')).toContainText('Demo Mode')
  await expect(page.locator('#section-brand-colours button')).toHaveCount(0)
  await expect(page.locator('[data-brand-preview=dark]')).toContainText(
    'dark theme uses the light theme colour',
  )
  expect(await mockApi.countRequests('updateBrandColors')).toBe(0)
  await expectAccessible()
})

test('T067 dirty leave cancellation preserves colour input', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('brand-colours-none')
  await page.goto('system/customize/colours')
  await page
    .locator('#section-brand-colours')
    .getByRole('button', { name: /^Edit / })
    .click()
  await page.locator('#brand-colour-light').fill('#1d4ed8')
  const nav = page.getByRole('navigation', { name: 'Customize', exact: true })
  if (await nav.getByRole('button').isVisible()) await nav.getByRole('button').click()
  await nav.getByRole('link', { name: 'UI labels and texts', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await expectAccessible()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /stay|keep/i })
    .click()
  await expect(page.locator('#brand-colour-light')).toHaveValue('#1d4ed8')
})
