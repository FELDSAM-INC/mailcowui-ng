import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures/test'
import { openAccountSections } from '../fixtures/flows'
import { MOCK_PASSWORD } from '../../mocks/scenarios/accounts'

async function toggleChoice(page: Page, id: string, value: string) {
  await page.locator(`[data-multiselect-trigger="${id}"]`).click()
  const choice = page.locator(`[data-multiselect-option="${value}"]`)
  const wasChecked = await choice.getAttribute('aria-checked')
  await choice.click()
  await expect(choice).toHaveAttribute('aria-checked', wasChecked === 'true' ? 'false' : 'true')
  await page.keyboard.press('Escape')
  await expect(page.locator('[role="menu"]')).toHaveCount(0)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true)
}

for (const scenario of ['admin-edit', 'domain-admin-edit']) {
  test(`${scenario} mailbox detail offers administration and Login on the right`, async ({
    page,
    mockApi,
  }) => {
    await mockApi.use(scenario)
    await mockApi.setFlags('reseller', { loginAs: true })
    await page.goto('mailboxes/anna@a.example')
    await expect(page.locator('#section-mailbox')).toBeVisible()
    await expect(page.locator('#pushover, #spam-filter, [data-mailbox-account-links]')).toHaveCount(
      0,
    )
    const login = page.getByRole('main').locator('header').getByRole('button', { name: /Login/ })
    await expect(login).toBeVisible()
    const header = page.getByRole('main').locator('header').first()
    const buttons = header.locator('button, a')
    await expect(buttons.last()).toContainText('Login')
    await page
      .locator('#section-mailbox')
      .getByRole('button', { name: /^Edit / })
      .click()
    await expect(page.locator('#section-mailbox-taggedMail-subfolder')).toHaveAttribute(
      'aria-pressed',
      /true|false/,
    )
    if (scenario === 'admin-edit') {
      await toggleChoice(page, 'section-mailbox-protocols', 'pop3')
      await page
        .locator('#section-mailbox')
        .getByRole('button', { name: 'Save changes', exact: true })
        .click()
      await expect(
        page.locator('[data-multiselect-trigger="section-mailbox-protocols"]'),
      ).toHaveCount(0)
      const update = (await mockApi.requests())
        .filter((request) => request.operationId === 'updateMailbox')
        .at(-1)
      expect(update?.body).toMatchObject({ protocolAccess: { pop3: false } })
    }
  })
}

test('mailbox creation uses shared choices and searchable ACL without losing selections', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('admin-create')
  await page.goto('mailboxes/new?domain=example.org')
  await page.getByLabel('Username (left part of an email address)').fill('controls')
  await page.locator('[data-generate]').click()
  await toggleChoice(page, 'mailbox-add-protocols', 'pop3')
  await page.locator('#mailbox-add-taggedMail-subfolder').click()
  await page.locator('#mailbox-add-quarantineCategory-all').click()
  await page.locator('#mailbox-add-tls-inbound').click()
  await page.locator('#mailbox-add-permissions').click()
  const menu = page.getByRole('menu')
  await menu.getByRole('searchbox').fill('password')
  await expect(menu.getByRole('menuitemcheckbox')).not.toHaveCount(0)
  await menu.getByRole('searchbox').press('ArrowDown')
  await expect(menu.getByRole('menuitemcheckbox').first()).toBeFocused()
  await page.keyboard.press('Escape')
  await page.locator('[data-sticky-save]').getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page).toHaveURL(/\/mailboxes\/controls@example\.org$/)
  const request = (await mockApi.requests()).find(
    (request) => request.operationId === 'createMailbox',
  )
  expect(request?.body).toMatchObject({
    protocolAccess: { pop3: false },
    taggedMailHandling: 'subfolder',
    quarantineCategory: 'all',
    tlsEnforceInbound: true,
  })
})

test('domain administrator ACL selection saves only its changed flag', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('domain-admins-three')
  await page.goto('administrators/domain-admins')
  await page.locator('[data-account-row]').first().press('Enter')
  const section = page.locator('#section-permissions')
  await section.getByRole('button', { name: /^Edit / }).click()
  await toggleChoice(page, 'account-permission', 'loginAs')
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('[data-multiselect-trigger]')).toHaveCount(0)
  const request = (await mockApi.requests())
    .filter((request) => request.operationId === 'updateDomainAdmin')
    .at(-1)
  expect(Object.keys((request?.body as { permissions: object }).permissions)).toEqual(['loginAs'])
})

test('app-password protocols use the same selector and preserve other choices on save', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/app-passwords/new')
  await page.getByLabel('App name', { exact: true }).fill('Shared controls')
  const trigger = page.locator('[data-multiselect-trigger]')
  await expect(trigger).toContainText('6 selected')
  await trigger.click()
  await page.locator('[data-multiselect-option="pop3"]').click()
  await page.keyboard.press('Escape')
  await expect(trigger).toContainText('5 selected')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const body = (await mockApi.requests()).find(
    (request) => request.operationId === 'createAppPassword',
  )?.body as { protocols: string[] }
  expect(body.protocols).toEqual(['imap', 'smtp', 'activeSync', 'dav', 'sieve'])
})

test('Overview links to recovery-email editing and Active Filter is absent from the menu', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/overview')
  const nav = await openAccountSections(page)
  await expect(nav.locator('[data-nav-item="account-activeScript"]')).toHaveCount(0)
  await nav.getByRole('link', { name: 'Overview', exact: true }).click()
  await page.locator('[data-edit-recovery-email]').click()
  await page.getByLabel('Email', { exact: true }).fill('new-recovery@example.net')
  await page.getByLabel('Current password (confirm changes)').fill(MOCK_PASSWORD)
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Changes to mailbox' })).toBeVisible()
  await page.goto('account/overview')
  await expect(page.locator('[data-mailbox-overview]')).toContainText('new-recovery@example.net')
})

test('a filter preset scrolls back to Script and focuses it', async ({ page, mockApi }) => {
  await mockApi.use('filters-many')
  await page.goto('filters/new?mailbox=anna@example.org')
  const preset = page.locator('[data-preset="sieve_8"] button')
  await preset.scrollIntoViewIfNeeded()
  await preset.click()
  const script = page.locator('#filter-script')
  await expect(script).not.toHaveValue('')
  await expect(script).toBeFocused()
  await expect.poll(async () => (await script.boundingBox())?.y).toBeGreaterThan(70)
  await expect
    .poll(async () => (await script.boundingBox())?.y)
    .toBeLessThan(page.viewportSize()!.height / 2)
  await page.locator('[data-preset="sieve_1"] button').click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(script).toBeFocused()
  await expect
    .poll(async () => (await script.boundingBox())?.y)
    .toBeLessThan(page.viewportSize()!.height / 2)
})

test('SPF diagnostics offer a copyable proposal derived from the current record', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('dns-diagnostics-all-statuses')
  await page.goto('dns/diagnostics/example.org')
  const proposal = page.locator('[data-check-id="spf"] [data-spf-proposal]')
  await expect(proposal.locator('[data-record-value]')).toHaveText(
    'v=spf1 ip4:192.0.2.25 ip6:2001:db8::25 -all',
  )
  await expect(proposal.getByRole('button', { name: 'Copy suggested SPF record' })).toBeVisible()
  await expect(proposal).toContainText('Replace the existing SPF TXT record')
})
