// T125: creating an API key (US7-AS2, AS3, AS10–AS12, FR-065, FR-066, FR-080, SC-010) and the
// one-time secret.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'

const SECRET = /^mcv2_[A-Za-z0-9]{40}$/

/** navigator.clipboard as a stub that records the copied text, or refuses. */
async function stubClipboard(page: Page, refuse = false) {
  await page.addInitScript((refuseCopy: boolean) => {
    const record = window as unknown as { __copied?: string }
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          if (refuseCopy) return Promise.reject(new DOMException('denied', 'NotAllowedError'))
          record.__copied = text
          return Promise.resolve()
        },
      },
    })
  }, refuse)
}

function form(page: Page) {
  return {
    name: page.getByRole('textbox', { name: 'Name' }),
    owner: page.getByRole('combobox', { name: 'Owner' }),
    readOnly: page.getByRole('radio', { name: 'Read-Only Access' }),
    readWrite: page.getByRole('radio', { name: 'Read-Write Access' }),
    never: page.getByRole('radio', { name: 'Never expires' }),
    days30: page.getByRole('radio', { name: 'In 30 days' }),
    custom: page.getByRole('radio', { name: 'On a specific date and time' }),
    customDate: page.getByLabel('Expiry date and time'),
    addNetwork: page.getByRole('button', { name: 'Add a network' }),
    submit: page.getByRole('button', { name: 'Create API key' }),
  }
}

async function openForm(page: Page) {
  await page.goto('api-keys/new')
  await expect(page.getByRole('heading', { level: 1, name: 'Create API key' })).toBeVisible()
  await expect(form(page).owner).toHaveValue('admin')
}

const secretDialog = (page: Page) => page.getByRole('dialog', { name: 'Your new API key' })

test('US7-AS10 FR-065 read-only and never-expires are preselected, the owner is the signed-in administrator, and the form explains the choices', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await mockApi.use('api-keys-empty')
  await openForm(page)
  const f = form(page)
  await expect(f.readOnly).toBeChecked()
  await expect(f.never).toBeChecked()
  const main = page.getByRole('main')
  await expect(main).toContainText(
    "A key owned by a domain administrator is limited to that administrator's domains and permissions.",
  )
  await expect(main).toContainText('A read-only key cannot change anything.')
  await expect(main).toContainText('Leave empty to allow any address.')
  await expect(main.getByRole('heading', { level: 2 })).toHaveText([
    'Name',
    'Owner',
    'Access',
    'Expiry',
    'Allow API access from these IPs/CIDR network notations',
  ])
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
})

test('US7-AS2 SC-010 the secret is shown once with a copy button, and the list then shows the prefix', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('api-keys-empty')
  await stubClipboard(page)
  await openForm(page)
  const f = form(page)
  await f.name.fill('Billing system')
  await f.readWrite.check()
  await f.addNetwork.click()
  await page.getByRole('textbox', { name: 'Allowed network 1' }).fill('192.0.2.0/24')
  await f.submit.click()

  const dialog = secretDialog(page)
  await expect(dialog).toBeVisible()
  const secretField = dialog.getByRole('textbox', { name: 'Secret' })
  const secret = await secretField.inputValue()
  expect(secret).toMatch(SECRET)
  await expect(dialog).toContainText('This secret is shown only once. It cannot be shown again.')
  await expectAccessible()
  await expectNoHorizontalScroll()
  await dialog.getByRole('button', { name: 'Copy' }).click()
  await expect(dialog.getByRole('status')).toContainText('Copied to the clipboard.')
  expect(await page.evaluate(() => (window as unknown as { __copied?: string }).__copied)).toBe(
    secret,
  )
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveCount(0)

  await expect(page.getByRole('heading', { level: 1, name: 'Billing system' })).toBeVisible()
  await expect(page).toHaveURL(/\/ng\/api-keys\/[0-9A-HJKMNP-TV-Z]{26}$/)
  await expect(page.getByRole('main')).toContainText(secret.slice(0, 12))
  await expect(page.locator('body')).not.toContainText(secret)
  await page.goto('api-keys')
  await expect(page.getByRole('main')).toContainText('Billing system')
  await expect(page.getByRole('main')).toContainText(secret.slice(0, 12))
  await expect(page.locator('body')).not.toContainText(secret)
  const [created] = (await mockApi.requests()).filter((r) => r.operationId === 'createApiKey')
  expect(created?.body).toEqual({
    name: 'Billing system',
    ownerUsername: 'admin',
    accessLevel: 'readWrite',
    expiresAt: null,
    allowedNetworks: ['192.0.2.0/24'],
  })
})

test('US7-AS3 a past expiry, a malformed network and an owner deactivated meanwhile are reported on their fields, and nothing is created', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('api-keys-many')
  await openForm(page)
  const f = form(page)
  await f.name.fill('Broken key')
  await f.custom.check()
  await f.customDate.fill('2020-01-01T10:00')
  await f.addNetwork.click()
  await f.addNetwork.click()
  await page.getByRole('textbox', { name: 'Allowed network 1' }).fill('192.0.2.0/24')
  await page.getByRole('textbox', { name: 'Allowed network 2' }).fill('999.1.1.1')
  await f.submit.click()
  const main = page.getByRole('main')
  await expect(main.getByText('Choose a time in the future.').first()).toBeVisible()
  await expect(main.getByText('Enter an IPv4 or IPv6 address or network').first()).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Allowed network 2' })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await expect(page.locator(':focus')).toContainText('Please correct the following')
  await expectAccessible()

  await f.never.check()
  await page.getByRole('button', { name: 'Remove network 2' }).click()
  await f.owner.fill('reseller0')
  await page.getByRole('option', { name: /^reseller01\b/ }).click()
  await expect(f.owner).toHaveValue('reseller01')
  await mockApi.patch({ accounts: { reseller01: { active: false } } })
  await f.submit.click()
  await expect(main.getByText('This item cannot be used here.').first()).toBeVisible()
  await expect(f.owner).toHaveAttribute('aria-invalid', 'true')
  const created = (await mockApi.requests()).filter(
    (r) => r.operationId === 'createApiKey' && r.status === 201,
  )
  expect(created).toHaveLength(0)
  await expect(secretDialog(page)).toHaveCount(0)
})

test('US7-AS12 the owner picker searches administrators and domain administrators, loads more and never offers mailbox users', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('api-keys-many')
  await openForm(page)
  const owner = form(page).owner
  await owner.fill('res')
  const listbox = page.getByRole('listbox', { name: 'Owner' })
  await expect(listbox.getByRole('option')).toHaveCount(25)
  await expect(listbox.getByRole('option').first()).toHaveText(/reseller\s*Domain administrator/)
  await expectAccessible()
  await page.getByRole('button', { name: 'Load more' }).click()
  await expect(listbox.getByRole('option')).toHaveCount(31)
  await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0)
  await owner.fill('alice')
  await expect(page.getByText('No administrators or domain administrators match.')).toBeVisible()
  await owner.fill('adm')
  await expect(listbox.getByRole('option')).toHaveCount(1)
  await owner.press('ArrowDown')
  await owner.press('Enter')
  await expect(owner).toHaveValue('admin')
  await expect(listbox).toHaveCount(0)
  const searches = (await mockApi.requests()).filter(
    (r) => r.operationId === 'listApiKeyOwnerCandidates',
  )
  expect(searches.some((r) => r.path.includes('q=res') && r.path.includes('offset=25'))).toBe(true)
})

test('US7-AS11 closing without copying asks for confirmation, and Back never shows the secret again', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('api-keys-empty')
  await page.goto('api-keys')
  await page.getByRole('link', { name: 'Create API key' }).first().click()
  await expect(form(page).owner).toHaveValue('admin')
  await form(page).name.fill('Uncopied')
  await form(page).submit.click()
  const dialog = secretDialog(page)
  const secret = await dialog.getByRole('textbox', { name: 'Secret' }).inputValue()
  await dialog.getByRole('button', { name: 'Close' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Have you saved the secret?' })
  await expect(confirm).toBeVisible()
  await expectAccessible()
  await confirm.getByRole('button', { name: 'Back to the secret' }).click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await page
    .getByRole('alertdialog', { name: 'Have you saved the secret?' })
    .getByRole('button', { name: 'Yes, I have saved it' })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Uncopied' })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/ng\/api-keys$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText(secret)
  await page.goForward()
  await expect(page.getByRole('heading', { level: 1, name: 'Uncopied' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText(secret)
})

test('FR-066 FR-080 Back or Escape while the secret is shown asks the same confirmation first', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('api-keys-empty')
  await page.goto('api-keys')
  await page.getByRole('link', { name: 'Create API key' }).first().click()
  await form(page).name.fill('Leaving')
  await form(page).submit.click()
  const dialog = secretDialog(page)
  await expect(dialog).toBeVisible()
  const confirm = page.getByRole('alertdialog', { name: 'Have you saved the secret?' })

  await page.goBack()
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Back to the secret' }).click()
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(/\/ng\/api-keys\/new$/)

  await page.keyboard.press('Escape')
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Back to the secret' }).click()
  await expect(dialog).toBeVisible()

  await page.goBack()
  await confirm.getByRole('button', { name: 'Yes, I have saved it' }).click()
  await expect(page).toHaveURL(/\/ng\/api-keys$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('Edge: when the clipboard is refused the secret is selected for manual copying', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('api-keys-empty')
  await stubClipboard(page, true)
  await openForm(page)
  await form(page).name.fill('Manual copy')
  await form(page).submit.click()
  const dialog = secretDialog(page)
  await dialog.getByRole('button', { name: 'Copy' }).click()
  await expect(dialog).toContainText(
    'The browser did not allow copying. The secret is selected: copy it yourself.',
  )
  const field = dialog.getByRole('textbox', { name: 'Secret' })
  const selection = await field.evaluate((input: HTMLInputElement) => [
    input.selectionStart,
    input.selectionEnd,
    input.value.length,
  ])
  expect(selection[0]).toBe(0)
  expect(selection[1]).toBe(selection[2])
  await expectAccessible()
})

test('FR-065 the expiry presets and a specific date are sent as future times', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('api-keys-empty')
  await stubClipboard(page)
  await openForm(page)
  await form(page).name.fill('Thirty days')
  await form(page).days30.check()
  const before = Date.now()
  await form(page).submit.click()
  await secretDialog(page).getByRole('button', { name: 'Copy' }).click()
  await secretDialog(page).getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Thirty days' })).toBeVisible()

  await openForm(page)
  await form(page).name.fill('Specific date')
  await form(page).custom.check()
  await form(page).customDate.fill('2031-03-04T05:06')
  await form(page).submit.click()
  await expect(secretDialog(page)).toBeVisible()

  const bodies = (await mockApi.requests())
    .filter((r) => r.operationId === 'createApiKey')
    .map((r) => r.body as { expiresAt: string })
  const thirty = new Date(bodies[0]!.expiresAt).getTime()
  expect(thirty - before).toBeGreaterThan(29.9 * 86_400_000)
  expect(thirty - before).toBeLessThan(30.1 * 86_400_000)
  const local = new Date(bodies[1]!.expiresAt)
  expect([local.getFullYear(), local.getMonth(), local.getDate(), local.getHours()]).toEqual([
    2031, 2, 4, 5,
  ])
})
