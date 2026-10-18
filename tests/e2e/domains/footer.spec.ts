// UI 002 US7, the domain-wide footer (T089) as the classic tab's section on the domain page: the
// legacy texts and variables, the exclusion multi-select of the domain's mailboxes, aliases and
// alias domains, the texts as source that is never rendered, the size limit, refused exclusions,
// the outdated handling and legacy's success message.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { isNarrow } from './helpers'

const SECTION = '#section-footer'

async function openFooter(page: Page, name: string) {
  await page.goto(`domains/${name}`)
  await expect(page.getByRole('heading', { level: 2, name: 'Domain wide footer' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit Domain wide footer' }).click()
  await expect(page.getByLabel('Exclude from footer')).toBeVisible()
}

const exclusions = (page: Page) => page.getByLabel('Exclude from footer')
const save = (page: Page) =>
  page.locator(SECTION).getByRole('button', { name: 'Save changes', exact: true }).click()

async function replacements(mockApi: {
  requests(): Promise<
    {
      operationId: string | null
      status: number
      body?: unknown
      headers: Record<string, string>
    }[]
  >
}) {
  return (await mockApi.requests()).filter(
    (request) => request.operationId === 'replaceDomainFooter' && request.status !== 403,
  )
}

test.describe('domain-wide footer', () => {
  test('US7-AS1 FR-057 plain.example opens empty, with the legacy explanation, variables and fields', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('footer')
    await openFooter(page, 'plain.example')
    const section = page.locator(SECTION)
    await expect(section).toContainText('Domain-wide footers are added to all outgoing emails')
    await expect(section.locator('[data-footer-variables]')).toContainText('{= auth_user =}')
    await expect(section.locator('[data-footer-variables]')).toContainText('{= foo =}')
    await expect(exclusions(page).locator('option')).toHaveText(['info@plain.example'])
    await expect(
      page.getByRole('checkbox', { name: 'Ignore footer on reply e-mails' }),
    ).not.toBeChecked()
    await expect(page.getByLabel('HTML footer')).toHaveValue('')
    await expect(page.getByLabel('PLAIN footer')).toHaveValue('')
    await expectAccessible()
    await expectNoHorizontalScroll()
  })

  test("US7-AS2 a domain administrator saves the texts and an excluded address; legacy's success is announced", async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('footer-domain-admin')
    await openFooter(page, 'plain.example')
    await exclusions(page).selectOption(['a:info@plain.example'])
    await page.getByLabel('HTML footer').fill('<p>Bye {= from_name =}</p>')
    await page.getByLabel('PLAIN footer').fill('Bye {= from_name =}')
    await save(page)
    await expect(page.locator('[data-live="polite"]')).toContainText(
      'Changes to domain footer plain.example have been saved',
    )
    const [request] = await replacements(mockApi)
    expect(request!.body).toEqual({
      html: '<p>Bye {= from_name =}</p>',
      plain: 'Bye {= from_name =}',
      skipReplies: false,
      excludedAddresses: ['info@plain.example'],
      excludedAliasDomains: [],
    })
    expect(request!.headers['if-match']).toMatch(/^".+"$/)
  })

  test('US7-AS3 Edge a stale exclusion is shown as stored, refused by the API and saved once removed', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('footer')
    await openFooter(page, 'footed.example')
    await expect(exclusions(page).locator('option')).toHaveText([
      'ann@footed.example',
      'bob@footed.example',
      'gone@footed.example',
      'sales@footed.example (Alias)',
      'alias.footed.example (Alias-Domain)',
    ])
    const selected = await exclusions(page).evaluate((select) =>
      [...(select as HTMLSelectElement).selectedOptions].map((option) => option.value),
    )
    expect(selected).toEqual([
      'a:bob@footed.example',
      'a:gone@footed.example',
      'd:alias.footed.example',
    ])
    await save(page)
    await expect(page.locator('#section-footer-exclude-error')).toContainText('gone@footed.example')
    await exclusions(page).selectOption(['a:bob@footed.example', 'd:alias.footed.example'])
    await save(page)
    await expect(page.locator('[data-live="polite"]')).toContainText(
      'Changes to domain footer footed.example have been saved',
    )
  })

  test('US7-AS4 FR-059 the script in the HTML footer is source text, in the view and in the editor', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('footer')
    let dialogs = 0
    page.on('dialog', () => (dialogs += 1))
    await page.goto('domains/footed.example')
    await expect(page.locator('[data-footer-html]')).toContainText('<script>alert(1)</script>')
    await expect(page.locator(`${SECTION} script`)).toHaveCount(0)
    await page.getByRole('button', { name: 'Edit Domain wide footer' }).click()
    await expect(page.getByLabel('HTML footer')).toHaveValue(
      '<p>Kind regards</p><script>alert(1)</script>',
    )
    expect(dialogs).toBe(0)
  })

  test('FR-060 a text above the size limit is refused before sending with the limit stated', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('footer', { capabilities: { footerTextMaxBytes: 16 } })
    await openFooter(page, 'plain.example')
    await page.getByLabel('PLAIN footer').fill('ž'.repeat(9))
    await save(page)
    await expect(page.locator('#section-footer-plain-error')).toContainText('16 B')
    expect(await replacements(mockApi)).toHaveLength(0)
  })

  test('FR-061 a footer changed elsewhere: the input is kept, the change listed, Save again saves', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('footer')
    await openFooter(page, 'plain.example')
    await page.getByLabel('PLAIN footer').fill('Mine')
    await mockApi.mutateFooter('plain.example', { skipReplies: true })
    await save(page)
    const notice = page.locator('[data-outdated]')
    await expect(notice).toContainText('Ignore footer on reply e-mails: now saved as Yes')
    await expect(page.getByLabel('PLAIN footer')).toHaveValue('Mine')
    await page.getByRole('button', { name: 'Save again' }).click()
    await expect(page.locator('[data-live="polite"]')).toContainText(
      'Changes to domain footer plain.example have been saved',
    )
    const saved = await replacements(mockApi)
    expect(saved.at(-1)!.body).toMatchObject({ plain: 'Mine', skipReplies: true })
  })

  test('FR-062 FR-069 leaving with changes asks first; on phones the actions stay in reach', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('footer')
    await openFooter(page, 'plain.example')
    if (isNarrow(page)) {
      await expect(page.locator(`${SECTION} [data-section-actions]`)).toHaveClass(/sticky/)
    }
    await page.getByLabel('HTML footer').fill('changed')
    await page.goBack()
    await expect(page.getByRole('alertdialog')).toContainText('Leave without saving?')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Stay' }).click()
    await expect(page.getByLabel('HTML footer')).toHaveValue('changed')
  })

  test('the footer read fails: the section says so and retries', async ({ page, mockApi }) => {
    await mockApi.use('footer')
    await mockApi.failNext('getDomainFooter', { status: 500 })
    await page.goto('domains/plain.example')
    await expect(page.locator(SECTION).getByRole('button', { name: 'Try again' })).toBeVisible()
    await page.locator(SECTION).getByRole('button', { name: 'Try again' }).click()
    await expect(page.locator('[data-footer-values]')).toBeVisible()
  })
})
