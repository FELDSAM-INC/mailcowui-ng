// UI 012 US5, the OAuth2 client page (T079), mirroring the classic "edit/oauth2client" page: the
// client ID and scope read-only, the redirect URIs editable in one field with "Save changes", no
// stored secret (owner decision), and no actions that the classic interface offers only in the
// list. Outdated saves keep the input and mark the change; a removed client shows "not found".
import { expect, test } from '../fixtures/test'
import { scenarioClient } from '../../mocks/scenarios/oauth2-clients'
import { fixedClientId } from './helpers'

test.describe('OAuth2 client page', () => {
  test('FR-060 the classic fields, without a secret or list-only actions', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('oauth2-many')
    await page.goto('identity-providers/oauth2-apps/3')
    await expect(page.getByRole('heading', { level: 1, name: 'OAuth2' })).toBeVisible()
    const main = page.getByRole('main')
    await expect(main).toContainText(fixedClientId(3))
    const section = page.locator('#section-oauth2-client')
    await expect(section).toContainText('Client ID')
    await expect(section).toContainText('Scope')
    await expect(section).toContainText('profile')
    await expect(section).toContainText('Redirect/Callback URL')
    await expect(section).toContainText('https://wiki.example.org/oauth/callback2')
    await expect(main).not.toContainText('Client secret')
    await expect(main.getByRole('button', { name: /Generate new client secret/ })).toHaveCount(0)
    await expect(main.getByRole('button', { name: /Revoke all client tokens/ })).toHaveCount(0)
    await expect(main.getByRole('button', { name: /Remove/ })).toHaveCount(0)
    await expectAccessible()
    await expectNoHorizontalScroll()
  })

  test('FR-060 saving a second redirect URI sends only the URIs with If-Match', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('oauth2-changed-elsewhere')
    await page.goto('identity-providers/oauth2-apps/1')
    await page.getByRole('button', { name: 'Edit OAuth2' }).click()
    await expect(page).toHaveURL(/edit=client/)
    const field = page.getByRole('textbox', { name: 'Redirect/Callback URL' })
    await expect(field).toHaveValue('https://app1.example.org/oauth/callback')
    await expect(page.getByRole('textbox', { name: 'Client ID' })).toHaveCount(0)
    await expectAccessible()
    await field.fill('https://app1.example.org/oauth/callback https://app1.example.org/cb2')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Changes to object 1 have been saved' }),
    ).toBeVisible()
    await expect(page.locator('#section-oauth2-client')).toContainText(
      'https://app1.example.org/cb2',
    )
    const [patch] = (await mockApi.requests()).filter((r) => r.operationId === 'updateOauth2Client')
    expect(patch?.body).toEqual({
      redirectUris: ['https://app1.example.org/oauth/callback', 'https://app1.example.org/cb2'],
    })
    expect(patch?.headers['if-match']).toMatch(/^"o/)
    expect(patch?.headers['content-type']).toContain('application/merge-patch+json')
  })

  test('FR-061 stored URIs that break the rules are marked and must be corrected before saving', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('oauth2-legacy-invalid')
    await page.goto('identity-providers/oauth2-apps/2')
    const section = page.locator('#section-oauth2-client')
    await expect(section).toContainText('https://legacy.example.org/cb#frag')
    await expect(section).toContainText(
      'Enter an absolute URI with a scheme, without # and without spaces.',
    )
    await page.getByRole('button', { name: 'Edit OAuth2' }).click()
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(
      page
        .getByRole('main')
        .getByText(/https:\/\/legacy\.example\.org\/cb#frag: Enter an absolute URI/),
    ).toBeVisible()
    expect(
      (await mockApi.requests()).filter((r) => r.operationId === 'updateOauth2Client'),
    ).toEqual([])
    await page
      .getByRole('textbox', { name: 'Redirect/Callback URL' })
      .fill('https://legacy.example.org/cb')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Changes to object 2 have been saved' }),
    ).toBeVisible()

    await page.goto('identity-providers/oauth2-apps/1')
    await page.getByRole('button', { name: 'Edit OAuth2' }).click()
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(
      page.getByRole('main').getByText('Redirect/Callback URL cannot be empty'),
    ).toBeVisible()
  })

  test('FR-066 SC-009 an outdated save keeps the input, marks the change and saves again with the new tag', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('oauth2-changed-elsewhere')
    await page.goto('identity-providers/oauth2-apps/1')
    await page.getByRole('button', { name: 'Edit OAuth2' }).click()
    const field = page.getByRole('textbox', { name: 'Redirect/Callback URL' })
    await field.fill('https://mine.example.org/cb')
    await mockApi.patch({
      oauth2Clients: [
        scenarioClient(1, { redirectUris: ['https://theirs.example.org/cb'], version: 2 }),
        scenarioClient(2),
      ],
    })
    await page.getByRole('button', { name: 'Save changes' }).click()
    const notice = page.locator('[data-outdated]')
    await expect(notice).toContainText('Changed elsewhere')
    await expect(notice).toContainText(
      'Redirect/Callback URL: now saved as https://theirs.example.org/cb',
    )
    await expect(field).toHaveValue('https://mine.example.org/cb')
    const patches = () =>
      mockApi.requests().then((all) => all.filter((r) => r.operationId === 'updateOauth2Client'))
    expect((await patches()).map((r) => r.status)).toEqual([412])
    await page.getByRole('button', { name: 'Save again' }).click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Changes to object 1 have been saved' }),
    ).toBeVisible()
    const sent = await patches()
    expect(sent.map((r) => r.status)).toEqual([412, 200])
    expect(sent[1]!.headers['if-match']).not.toBe(sent[0]!.headers['if-match'])
  })

  test('Edge: a client deleted by another administrator, and an unknown ID, show "not found"', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('oauth2-deleted-elsewhere')
    await mockApi.patch({ oauth2Clients: [scenarioClient(1)] })
    await page.goto('identity-providers/oauth2-apps/2')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await expectAccessible()
    await page.getByRole('link', { name: 'Back to the OAuth2 apps' }).click()
    await expect(page).toHaveURL(/\/ng\/identity-providers\/oauth2-apps$/)
    await page.goto('identity-providers/oauth2-apps/999')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  })
})
