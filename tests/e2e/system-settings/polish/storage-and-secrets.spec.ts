import type { Page } from '@playwright/test'
import { expect, test } from '../../fixtures/test'

async function cleanStorage(page: Page, privateValues: readonly string[]) {
  const state = await page.evaluate(() => ({
    keys: [...Object.keys(localStorage), ...Object.keys(sessionStorage)],
    stored: JSON.stringify({ ...localStorage, ...sessionStorage }),
    history: JSON.stringify(history.state),
    url: location.href,
  }))
  expect(
    state.keys.filter(
      (key) =>
        ![
          'mailcowui-ng.locale',
          'mailcowui-ng.theme',
          'mailcowui-ng.announcement-collapsed',
        ].includes(key),
    ),
  ).toEqual([])
  for (const value of privateValues)
    for (const surface of [state.stored, state.history, state.url])
      expect(surface).not.toContain(value)
}

test('T172 mass-mail message and selection never enter storage or history and leave with the page', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('mass-mail-120')
  await page.goto('system/mass-mail/send')
  const privateValues = ['Private notice 9271', 'Private body 9271', 'user120@example.com']
  await page.getByLabel('Include/Exclude', { exact: true }).selectOption('exclude')
  await page.getByLabel('Paste mailbox addresses').fill(privateValues[2]!)
  await page.getByRole('button', { name: 'Add addresses', exact: true }).click()
  const next = page
    .locator('[data-compose-step-actions]')
    .getByRole('button', { name: 'Next', exact: true })
  if (await next.isVisible()) await next.click()
  await page.getByLabel('Subject', { exact: true }).fill(privateValues[0]!)
  await page.getByLabel('Text', { exact: true }).fill(privateValues[1]!)
  await cleanStorage(page, privateValues)
  if (await next.isVisible()) await next.click()
  else await page.getByRole('button', { name: 'Preview recipients', exact: true }).click()
  await expect(page.locator('[data-recipient-count]')).toContainText('119')
  if (await next.isVisible()) await next.click()
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText(privateValues[0]!)
  await cleanStorage(page, privateValues)
  await dialog.getByRole('button', { name: 'Send to 119 mailboxes' }).click()
  await expect(page).toHaveURL(/mass-mail\/jobs\/[0-9A-HJKMNP-TV-Z]{26}$/)
  await cleanStorage(page, privateValues)
  await page.getByRole('link', { name: 'Mass mail jobs', exact: true }).last().click()
  await page.getByRole('link', { name: 'Compose', exact: true }).first().click()
  await expect(page.getByLabel('Include/Exclude', { exact: true })).toHaveValue('none')
  await expect(page.locator('[data-picker-chips]')).toHaveCount(0)
  if (await next.isVisible()) await next.click()
  await expect(page.getByLabel('Subject', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Text', { exact: true })).toHaveValue('')
  await cleanStorage(page, privateValues)
  await expectAccessible()
})

// Exercise data and controls, rather than treating a rendered page heading as readiness.
async function editText(page: Page, sectionId: string, field: string, value: string) {
  const section = page.locator(sectionId)
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator(field).fill(value)
  await expect(page.locator(field)).toHaveValue(value)
  await section.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(section.locator('form')).toHaveCount(0)
}

const storageCases: {
  name: string
  scenario: string
  path: string
  exercise: (page: Page) => Promise<void>
}[] = [
  {
    name: 'colours',
    scenario: 'brand-colours-none',
    path: 'system/customize/colours',
    exercise: (page) => editText(page, '#section-brand-colours', '#brand-colour-light', '#1d4ed8'),
  },
  {
    name: 'CORS',
    scenario: 'settings-admin-defaults',
    path: 'system/cors',
    exercise: (page) =>
      editText(page, '#section-cors', '#cors-origins', 'https://portal.example.org'),
  },
  {
    name: 'license',
    scenario: 'settings-license-valid',
    path: 'system/license',
    exercise: async (page) => {
      await expect(page.locator('[data-license-guid]')).toHaveText('a'.repeat(64))
      await page.locator('[data-verify-license]').click()
      await expect(page.locator('[data-license-result]')).toContainText('customer-123')
    },
  },
  {
    name: 'sign-in options',
    scenario: 'idp-none',
    path: 'system/customize/login-page',
    exercise: async (page) => {
      const section = page.locator('#section-sign-in-links')
      await section.getByRole('button', { name: /^Edit / }).click()
      await page.locator('#login-page-hideMailboxUserLogin').check()
      await expect(page.locator('#login-page-hideMailboxUserLogin')).toBeChecked()
      await section.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(section.locator('form')).toHaveCount(0)
    },
  },
  {
    name: 'app links',
    scenario: 'app-links-three',
    path: 'system/customize/app-links',
    exercise: (page) => editText(page, '#section-app-links', '#app-link-0-name', 'Helpdesk'),
  },
  {
    name: 'global Sieve',
    scenario: 'global-sieve-default',
    path: 'system/global-sieve-filters',
    exercise: async (page) => {
      const pre = page.locator('[data-global-filter=prefilter]')
      await pre.getByRole('button', { name: 'Edit', exact: true }).click()
      await pre.locator('textarea').fill('# Storage denied draft\nkeep;')
      await expect(pre.locator('textarea')).toHaveValue('# Storage denied draft\nkeep;')
      await pre.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(pre.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
    },
  },
  {
    name: 'logos',
    scenario: 'branding-light-logo',
    path: 'system/customize/logos',
    exercise: async (page) => {
      const card = page.locator('[data-logo-card="light"]')
      await expect(card.locator('[data-logo-current]')).toContainText('image/png')
      await card.getByRole('button', { name: 'Reset to default', exact: true }).click()
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Cancel', exact: true })
        .click()
      await expect(page.getByRole('alertdialog')).toHaveCount(0)
    },
  },
  {
    name: 'UI texts',
    scenario: 'ui-texts-custom',
    path: 'system/customize/ui-texts',
    exercise: (page) => editText(page, '#section-names', '#ui-text-productName', 'Private draft'),
  },
  {
    name: 'mass-mail compose',
    scenario: 'mass-mail-none',
    path: 'system/mass-mail/send',
    exercise: async (page) => {
      await expect(
        page.getByRole('heading', { level: 2, name: 'Recipients', exact: true }),
      ).toBeVisible()
      await page.getByLabel('Include/Exclude', { exact: true }).selectOption('exclude')
      const input = page.getByLabel('Paste mailbox addresses')
      await input.fill('user1@example.com')
      await expect(input).toHaveValue('user1@example.com')
    },
  },
  {
    name: 'mass-mail jobs',
    scenario: 'mass-mail-completed',
    path: 'system/mass-mail/jobs',
    exercise: async (page) => {
      await page.getByRole('link', { name: 'Maintenance', exact: true }).click()
      await page.getByLabel('Recipient outcome').selectOption('failed')
      await expect(page.locator('[data-job-recipient]')).toHaveCount(6)
    },
  },
  {
    name: 'quota notifications',
    scenario: 'quota-defaults',
    path: 'system/quota-notifications',
    exercise: (page) =>
      editText(page, '#section-notification-email', '#quota-subject', 'Storage warning'),
  },
  {
    name: 'Rspamd rules',
    scenario: 'rspamd-rules-30',
    path: 'system/rspamd-rules',
    exercise: async (page) => {
      await expect(page.locator('[data-rule-id]')).toHaveCount(25)
      await page.getByRole('searchbox', { name: 'Search:', exact: true }).fill('needle-content')
      await expect(page.locator('[data-rule-id]')).toHaveCount(3)
    },
  },
  {
    name: 'filter maps',
    scenario: 'filter-maps-13',
    path: 'system/filter-maps',
    exercise: async (page) => {
      await expect(page.locator('main a[href*="/system/filter-maps/"]')).toHaveCount(13)
      await page.locator('#map-search').fill('Envelope Sender')
      await expect(page.locator('main a[href*="/system/filter-maps/"]')).toHaveCount(2)
      await page.getByRole('link', { name: /Envelope Sender Denylist/ }).click()
      await expect(page.locator('#regex-content')).toHaveValue(
        '# Existing patterns\n/old.example/i\n',
      )
    },
  },
  {
    name: 'password policy and reset',
    scenario: 'settings-admin-defaults',
    path: 'system/password-policy',
    exercise: async (page) => {
      await expect(page.locator('[data-policy-length]')).toHaveText('6')
      await editText(page, '#section-policy', '#policy-minLength', '10')
      await expect(page.locator('#section-password-reset')).toBeVisible()
    },
  },
  {
    name: 'Rspamd UI',
    scenario: 'settings-admin-defaults',
    path: 'system/rspamd-web-interface',
    exercise: async (page) => {
      const password = page.getByLabel('Password', { exact: true })
      await password.fill('Private Rspamd draft')
      await expect(password).toHaveValue('Private Rspamd draft')
      await page.getByRole('button', { name: 'Toggle password visibility', exact: true }).click()
      await expect(password).toHaveAttribute('type', 'text')
      await password.fill('')
    },
  },
  {
    name: 'IP check',
    scenario: 'settings-admin-defaults',
    path: 'system/ip-check',
    exercise: async (page) => {
      const section = page.locator('#section-opt-in')
      await expect(section.locator('[data-ip-check-value]')).toHaveText('No')
      await section.getByRole('button', { name: /^Edit / }).click()
      await page.locator('#ip-check-enabled').check()
      await expect(page.locator('#ip-check-enabled')).toBeChecked()
      await section.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(section.locator('[data-ip-check-value]')).toHaveText('No')
    },
  },
]

for (const { name, scenario, path, exercise } of storageCases)
  test(`T172 denied storage keeps ${name} usable`, async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(() => {
      for (const name of ['localStorage', 'sessionStorage'] as const)
        Object.defineProperty(window, name, {
          configurable: true,
          get() {
            throw new DOMException('Storage denied', 'SecurityError')
          },
        })
    })
    await mockApi.use(scenario)
    await page.goto(path)
    await exercise(page)
    await page.evaluate(() => scrollTo(0, 0))
    await expectAccessible()
    await expectNoHorizontalScroll()
    expect(errors).toEqual([])
  })
