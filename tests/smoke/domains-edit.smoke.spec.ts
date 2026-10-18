// UI 002 US3 smoke test (T059, research D29): the "Edit domain" section, which mirrors the classic
// Domain tab, as admin on a smoke domain, and the Global Address List flag as reseller on
// example.net with the limits read-only (legacy shows them only to administrators). Not on
// example.org: its seeded maximum mailbox quota exceeds its domain quota, and API 4c25767 then
// refuses every edit of the domain (reported to the API).
import { expect, test, type Page } from '@playwright/test'

import { createDomain, deleteDomain, signIn, uniqueName } from './fixtures/domains-api'

const SECTION = '#section-domain'

async function edit(page: Page) {
  await page.getByRole('button', { name: 'Edit Edit domain' }).click()
}

async function save(page: Page, name: string) {
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('[data-live="polite"]')).toContainText(
    `Changes to domain ${name} have been saved`,
  )
}

test.describe('@domains edit', () => {
  test('admin raises the mailbox limit, adds a tag and switches a relay option', async ({
    page,
  }) => {
    const name = `${uniqueName('smoke-edit')}.example`
    await signIn(page, 'admin')
    await createDomain(page, name)
    try {
      await page.goto(`domains/${name}`)
      await edit(page)
      const section = page.locator(SECTION)
      await section
        .getByRole('textbox', { name: 'Max. possible mailboxes', exact: true })
        .fill('25')
      await section.getByRole('combobox', { name: 'Tags' }).fill('smoke')
      await section.getByRole('combobox', { name: 'Tags' }).press('Enter')
      await section.getByLabel('Relay this domain').check()
      await save(page, name)
      await expect(section).toContainText('25')
      await expect(section).toContainText('smoke')
      const read = await page.request.get(`/api/v2/domains/${name}`)
      const saved = ((await read.json()) as { data: Record<string, unknown> }).data
      expect(saved).toMatchObject({ maxMailboxes: 25, tags: ['smoke'], backupMx: true })
    } finally {
      await deleteDomain(page, name)
    }
  })

  test('reseller changes the Global Address List flag and back, with the limits read-only', async ({
    page,
  }) => {
    await signIn(page, 'reseller')
    await page.goto('domains/example.net')
    await edit(page)
    const section = page.locator(SECTION)
    await expect(
      section.getByRole('textbox', { name: 'Max. possible mailboxes', exact: true }),
    ).toHaveCount(0)
    for (let round = 0; round < 2; round += 1) {
      if (round > 0) await edit(page)
      const flag = section.getByRole('checkbox', { name: 'Global Address List' })
      if (await flag.isChecked()) await flag.uncheck()
      else await flag.check()
      await save(page, 'example.net')
    }
  })
})
