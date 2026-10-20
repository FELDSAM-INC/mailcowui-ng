// UI013 T110: create only an inactive temporary rule; remove it even when an assertion fails.
import { expect, test } from '@playwright/test'
import type { RspamdSettingsRule, RspamdEffectiveSettingsMap } from '@/api'
import { csrfToken, requireLocalStack } from '../fixtures/account-api'
import { admin } from '../fixtures/accounts'
import { expectHome, signIn, signOut } from '../fixtures/flows'

test('@013 @local-stack inactive Rspamd rule checks, saves and deletes without affecting effective rules', async ({
  page,
  baseURL,
}) => {
  requireLocalStack(baseURL)
  await signIn(page, admin.username, admin.password)
  await expectHome(page, admin.username)
  const description = `UI013 inactive smoke ${Date.now()}`
  let item: RspamdSettingsRule | undefined
  try {
    await page.goto('system/rspamd-rules/-/new')
    await page.locator('#rule-description').fill(description)
    await page
      .locator('#rule-content')
      .fill('priority = 10;\napply { symbols = ["UI013_INACTIVE_TEST"]; }')
    await page.locator('#rule-active').uncheck()
    await page.locator('[data-rule-check]').click()
    await expect(page.locator('[data-rule-checked]')).toBeVisible()
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/settings/rspamd-rules') && response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    const response = await responsePromise
    expect(response.status()).toBe(201)
    item = ((await response.json()) as { data: RspamdSettingsRule }).data
    expect(item.active).toBe(false)
    expect(item.description).toBe(description)
    await expect(page).toHaveURL(new RegExp(`rspamd-rules/${item.id}$`))
    const mapResponse = await page.request.get('/api/v2/settings/rspamd-settings-map')
    expect([200, 503]).toContain(mapResponse.status())
    if (mapResponse.status() === 200) {
      const map = ((await mapResponse.json()) as { data: RspamdEffectiveSettingsMap }).data
      expect(map.content).not.toContain(`additional_settings_${item.id}`)
    } else {
      expect((await mapResponse.json()).type).toBe('/api/v2/problems/temporary-failure')
      test.info().annotations.push({
        type: 'environment',
        description:
          'The local stack has no effective Rspamd settings-map dependency; GET returned503. No dependency settings were changed.',
      })
    }
    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Delete now', exact: true })
      .click()
    await expect(page).toHaveURL(/system\/rspamd-rules$/)
    expect((await page.request.get(`/api/v2/settings/rspamd-rules/${item.id}`)).status()).toBe(404)
    // The real dependency can take five seconds to time out; wait for its response rather
    // than racing the default assertion timeout while the page correctly shows Loading.
    const visibleMapResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/settings/rspamd-settings-map') &&
        response.request().method() === 'GET',
    )
    await page
      .getByRole('main')
      .getByRole('link', { name: 'Active settings map', exact: true })
      .click()
    const visibleMapResponse = await visibleMapResponsePromise
    expect([200, 503]).toContain(visibleMapResponse.status())
    if (visibleMapResponse.status() === 200)
      await expect(page.locator('#effective-settings-map')).toHaveAttribute('readonly', '')
    else await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
  } finally {
    // Recover the ID even if the browser lost its create response after the API committed it.
    if (!item) {
      const listed = await page.request.get('/api/v2/settings/rspamd-rules', {
        params: { q: description },
      })
      if (listed.ok())
        item = ((await listed.json()) as { data: RspamdSettingsRule[] }).data.find(
          (rule) => rule.description === description,
        )
    }
    if (item) {
      const read = await page.request.get(`/api/v2/settings/rspamd-rules/${item.id}`)
      if (read.status() === 200) {
        const fresh = ((await read.json()) as { data: RspamdSettingsRule }).data
        expect(fresh.active, 'Only the inactive smoke rule may be removed').toBe(false)
        const removed = await page.request.delete(`/api/v2/settings/rspamd-rules/${fresh.id}`, {
          headers: { 'X-CSRF-Token': await csrfToken(page), 'If-Match': fresh.etag },
        })
        expect(removed.status(), 'Clean up the inactive smoke rule').toBe(204)
      } else expect(read.status()).toBe(404)
    }
  }
  await signOut(page)
})
