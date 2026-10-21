// UI 004 US8, "History" of the feature 004 objects (T103): administrators open UI 001's audit log
// filtered to the alias, the domain alias, the resource or a mailbox's sender permissions; the
// entries show translated labels and their changes as text, and each target links back to its
// object. Domain administrators have no History control.
import { HISTORY_004 } from '../../mocks/scenarios/history-004'
import { expect, test } from '../fixtures/test'
import type { Page } from '@playwright/test'

const history = (page: Page) => page.getByRole('link', { name: /^History/ })

async function openHistory(
  page: Page,
  from: string,
  name: string | RegExp = /^History$/,
  section?: string,
) {
  await page.goto(from)
  const source = section ? page.locator(section) : page
  await source.getByRole('link', { name, exact: true }).first().click()
  await expect(page).toHaveURL(/\/ng\/audit-log\?/)
}

test.describe('feature 004 history', () => {
  test('US8-AS1 FR-061 the alias page opens its history with translated entries and changes as text', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('history-004')
    await openHistory(page, `aliases/${HISTORY_004.alias.id}`)
    const url = new URL(page.url())
    expect(url.searchParams.get('targetType')).toBe('alias')
    expect(url.searchParams.get('targetId')).toBe(HISTORY_004.alias.id)
    await expect(page.getByText('Alias changed').first()).toBeVisible()
    await page
      .getByRole('button', { name: /details/i })
      .first()
      .click()
    await expect(
      page.getByText('anna@example.org → anna@example.org, bob@example.org'),
    ).toBeVisible()
    await expect(
      page
        .getByRole('link', { name: new RegExp(HISTORY_004.alias.name.replace('.', '\\.')) })
        .first(),
    ).toHaveAttribute('href', new RegExp(`/ng/aliases/${HISTORY_004.alias.id}$`))
  })

  test('FR-061 the domain alias, resource and sender permission histories are filtered to their object', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('history-004')
    for (const [from, target, name, section] of [
      [
        `alias-domains/${HISTORY_004.aliasDomain.id}`,
        HISTORY_004.aliasDomain,
        /^History$/,
        undefined,
      ],
      [`resources/${HISTORY_004.resource.id}`, HISTORY_004.resource, /^History$/, undefined],
      [
        `mailboxes/${HISTORY_004.senderSettings.id}`,
        HISTORY_004.senderSettings,
        'History: Allow to send as',
        '#section-mailbox',
      ],
    ] as const) {
      await openHistory(page, from, name, section)
      const url = new URL(page.url())
      expect(url.searchParams.get('targetType')).toBe(target.type)
      expect(url.searchParams.get('targetId')).toBe(target.id)
    }
  })

  test('US8-AS2 domain administrators have no History control', async ({ page, mockApi }) => {
    await mockApi.use('history-004-da')
    await page.goto(`aliases/${HISTORY_004.alias.id}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Edit alias' })).toBeVisible()
    await expect(history(page)).toHaveCount(0)
    await page.goto(`alias-domains/${HISTORY_004.aliasDomain.id}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(history(page)).toHaveCount(0)
    await page.goto(`resources/${HISTORY_004.resource.id}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(history(page)).toHaveCount(0)
  })
})
