import { readFileSync } from 'node:fs'
import { expect, test } from '../../fixtures/test'

const hostile = readFileSync('tests/fixtures/email/hostile.html', 'utf8').replace(
  '<body ',
  `<body ${Array.from({ length: 40 }, (_, i) => `on${'x'.repeat(i + 1)}="bad()"`).join(' ')} style="font-weight:normal" `,
)

test('FR-090/SC-010 preview isolates hostile HTML, replaces samples, and loads no remote resource', async ({
  page,
  baseURL,
  mockApi,
  expectNoHorizontalScroll,
  expectAccessible,
}) => {
  await mockApi.use('password-reset-custom', {
    settings: { passwordReset: { htmlTemplate: hostile } },
  })
  const remote: string[] = []
  const dialogs: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== new URL(baseURL!).origin) remote.push(request.url())
  })
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message())
    await dialog.dismiss()
  })
  await page.goto('system/password-policy')
  await expect(page.locator('iframe')).toHaveCount(0)
  await page.locator('#section-password-reset summary').filter({ hasText: 'HTML Template' }).click()
  await page.getByRole('button', { name: 'Preview HTML template', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Preview HTML template' })
  await expect(dialog).toBeVisible()
  const iframe = dialog.locator('iframe')
  await expect(iframe).toHaveAttribute('sandbox', 'allow-same-origin')
  await expect(iframe).not.toHaveAttribute('src')
  await expect(iframe).not.toHaveAttribute('srcdoc')
  const content = page.frameLocator('iframe').locator('body')
  await expect(content).toContainText('Hello user@example.org at mail.example.org')
  await expect(content).toContainText('Image not loaded in the preview: Remote logo')
  await expect(content).toContainText('Image not loaded in the preview: Inline logo')
  await expect(content.locator('p').first()).toHaveCSS('font-weight', '700')
  await expect(
    content.locator('script,style,iframe,form,input,button,base,meta,link,img,svg,[src],[href]'),
  ).toHaveCount(0)
  await content.getByText('Reset password', { exact: true }).click()
  await expect(page).toHaveURL(/system\/password-policy$/)
  expect(
    await page.evaluate(() => (window as Window & { __pwned?: boolean }).__pwned),
  ).toBeUndefined()
  await expectNoHorizontalScroll()
  // The operator-authored email is isolated from the application and deliberately cannot run
  // axe in its scriptless document. Check the app dialog; the frame title is asserted above.
  await expectAccessible(page, { exclude: ['iframe'] })
  expect(remote).toEqual([])
  expect(dialogs).toEqual([])
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.locator('iframe')).toHaveCount(0)
})
