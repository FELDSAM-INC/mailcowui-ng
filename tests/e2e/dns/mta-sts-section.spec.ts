// UI 010 US4, the MTA-STS section of the domain page (T065), in the classic form settled by the
// legacy form map: no policy, set-up with legacy's defaults, a change that renews the identifier,
// deactivation and activation, the client checks, an outdated save, leaving with unsaved changes,
// duplicates, a policy created elsewhere, the domain administrator and the `#mta-sts` address.
// The alias domain page belongs to UI 004, which mounts the exported alias section (unit-tested).
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { FIRST_LOAD } from './helpers'

const section = (page: Page) => page.locator('#mta-sts')

async function openSection(page: Page, domain: string) {
  await page.goto(`domains/${domain}`)
  await expect(section(page).getByRole('heading', { level: 2, name: 'MTA-STS' })).toBeVisible({
    timeout: FIRST_LOAD,
  })
}

async function edit(page: Page) {
  await section(page).getByRole('button', { name: 'Edit MTA-STS' }).click()
  await expect(page.locator('#mta-sts-mode')).toBeVisible()
}

const save = (page: Page) => section(page).getByRole('button', { name: 'Save changes' }).click()

test.describe('MTA-STS section', () => {
  test('US4-AS1 a domain without a policy says so, with the classic explanation', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('dns-mta-sts')
    await openSection(page, 'example.net')
    await expect(section(page)).toContainText('No MTA-STS policy is set up for this domain.')
    await expect(section(page)).toContainText('is a standard that enforces email delivery')
    await expect(section(page).getByRole('link', { name: 'MTA-STS', exact: true })).toHaveAttribute(
      'target',
      '_blank',
    )
    await expectAccessible()
    await expectNoHorizontalScroll()
  })

  test('US4-AS2 FR-047 the set-up form starts as the classic form does and creates the policy', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
    isMobile,
  }) => {
    test.slow()
    await mockApi.use('dns-mta-sts')
    await openSection(page, 'example.net')
    await edit(page)
    await expect(page.locator('#mta-sts-version')).toHaveValue('STSv1')
    await expect(page.locator('#mta-sts-mode')).toHaveValue('enforce')
    await expect(page.locator('#mta-sts-max-age')).toHaveValue('')
    await expect(page.locator('#mta-sts-mx')).toHaveValue('mail.example.org')
    await expect(page.locator('#mta-sts-active')).not.toBeChecked()
    await expect(section(page).locator('[data-certificate-notice]')).toContainText(
      'certificate for mta-sts.example.net',
    )
    await expect(section(page).getByText('Time in seconds')).toBeVisible()
    await expectAccessible()
    await expectNoHorizontalScroll()
    if (isMobile) await expectTouchTargets()
    await page.locator('#mta-sts-mx').fill('mail.example.org, mx2.example.org')
    await page.locator('#mta-sts-max-age').fill('86400')
    await page.locator('#mta-sts-active').check()
    await save(page)
    await expect(section(page)).toContainText('Changes to object example.net have been saved')
    const created = (await mockApi.requests()).find(
      (request) => request.operationId === 'createMtaStsPolicy',
    )
    expect(created?.body).toEqual({
      domain: 'example.net',
      version: 'STSv1',
      mode: 'enforce',
      maxAge: 86400,
      mxHosts: ['mail.example.org', 'mx2.example.org'],
      active: true,
    })
    await expect(section(page)).toContainText('STSv1')
    await expect(section(page).locator('[data-policy-id]')).toHaveText(/^\d{14}$/)
    await expect(
      section(page).getByRole('link', { name: /https:\/\/mta-sts\.example\.net/ }),
    ).toHaveAttribute('target', '_blank')
    await expect(
      section(page).getByRole('button', { name: 'Copy value of _mta-sts.example.net' }),
    ).toBeVisible()
    await expect(
      section(page).getByRole('button', { name: 'Copy name of mta-sts.example.net' }),
    ).toBeVisible()
    await expect(section(page).locator('[data-activation-notice]')).toBeVisible()
    await expectAccessible()
  })

  test('US4-AS3 FR-050 a changed mode names the old and new identifier and highlights the record', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    test.slow()
    await mockApi.use('dns-mta-sts')
    await openSection(page, 'example.org')
    const before = (await section(page).locator('[data-policy-id]').textContent())?.trim() ?? ''
    await edit(page)
    await page.locator('#mta-sts-mode').selectOption('testing')
    await save(page)
    const notice = section(page).locator('[data-policy-id-notice]')
    await expect(notice).toContainText(before)
    const after = (await section(page).locator('[data-policy-id]').textContent())?.trim() ?? ''
    expect(after).not.toBe(before)
    await expect(notice).toContainText(after)
    await expect(notice).toContainText('_mta-sts.example.org')
    const record = section(page).locator('[data-highlighted-record]')
    await expect(record).toContainText('Update this record')
    await expect(record).toContainText(`v=STSv1;id=${after};`)
    const patch = (await mockApi.requests()).find(
      (request) => request.operationId === 'updateMtaStsPolicy',
    )
    expect(patch?.body).toEqual({ mode: 'testing' })
    expect(patch?.headers['if-match']).toBeTruthy()
    expect(patch?.headers['content-type']).toContain('application/merge-patch+json')
    await expectAccessible()
  })

  test('US4-AS7 SC-015 deactivating asks first and keeps the identifier; activating shows the certificate notice', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    test.slow()
    await mockApi.use('dns-mta-sts')
    await openSection(page, 'example.org')
    const id = (await section(page).locator('[data-policy-id]').textContent())?.trim()
    await edit(page)
    await page.locator('#mta-sts-active').uncheck()
    await save(page)
    const dialog = page.getByRole('alertdialog', { name: 'Deactivate the MTA-STS policy?' })
    await expect(dialog).toContainText('no longer be published')
    await expect(dialog).toContainText('up to its max age')
    await expect(dialog).toContainText('no longer be requested')
    await expectAccessible()
    await dialog.getByRole('button', { name: 'Deactivate' }).click()
    await expect(section(page).locator('[data-mta-sts-active]')).toHaveText('Inactive')
    await expect(section(page).locator('[data-policy-id]')).toHaveText(id ?? '')
    await expect(section(page).locator('[data-policy-id-notice]')).toHaveCount(0)
    await edit(page)
    await page.locator('#mta-sts-active').check()
    await save(page)
    await expect(section(page).locator('[data-activation-notice]')).toContainText(
      'certificate for mta-sts.example.org',
    )
    await expect(section(page).locator('[data-policy-id-notice]')).toHaveCount(0)
  })

  test('US4-AS4 FR-048 invalid entries get the classic messages and nothing is sent', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    test.slow()
    await mockApi.use('dns-mta-sts')
    await openSection(page, 'example.org')
    await edit(page)
    await page.locator('#mta-sts-mx').fill('mail.example.org, mail..example')
    await page.locator('#mta-sts-max-age').fill('0')
    await save(page)
    await expect(section(page)).toContainText('MX record mail..example is invalid')
    await expect(section(page)).toContainText('Max age example.org is invalid')
    await expect(page.locator('#mta-sts-mx')).toHaveAttribute('aria-invalid', 'true')
    await expectAccessible()
    const hosts = Array.from(
      { length: 16 },
      (_, i) => `mx${String(i).padStart(2, '0')}.example.org`,
    )
    await page.locator('#mta-sts-max-age').fill('604800')
    await page.locator('#mta-sts-mx').fill(hosts.join(', '))
    await expect(page.locator('[data-mx-length]')).toContainText('of 255 characters')
    await page.locator('#mta-sts-mx').fill([...hosts, 'mx16.example.org'].join(', '))
    await save(page)
    await expect(section(page)).toContainText('Enter at most 255 characters.')
    const writes = (await mockApi.requests()).filter(
      (request) => request.operationId === 'updateMtaStsPolicy',
    )
    expect(writes).toEqual([])
  })

  test('US4-AS5 SC-010 an outdated save keeps the input, lists the change, and saves again', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    test.slow()
    await mockApi.use('dns-mta-sts')
    await openSection(page, 'example.org')
    await edit(page)
    await mockApi.patch({ dns: { policies: { 'example.org': { maxAge: 86400 } } } })
    await page.locator('#mta-sts-mode').selectOption('none')
    await save(page)
    const outdated = section(page).locator('[data-outdated]')
    await expect(outdated).toContainText('Max age: now saved as 86400')
    await expect(page.locator('#mta-sts-mode')).toHaveValue('none')
    await expectAccessible()
    await section(page).getByRole('button', { name: 'Save again' }).click()
    await expect(section(page)).toContainText('Changes to object example.org have been saved')
    await expect(section(page).locator('[data-mta-sts-facts]')).toContainText('86,400')
    await expect(section(page).locator('[data-mta-sts-facts]')).toContainText('none')
  })

  test('US4-AS5 discarding after an outdated save takes the saved values', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-mta-sts')
    await openSection(page, 'example.org')
    await edit(page)
    await mockApi.patch({ dns: { policies: { 'example.org': { mode: 'testing' } } } })
    await page.locator('#mta-sts-max-age').fill('3600')
    await save(page)
    await section(page).getByRole('button', { name: 'Discard my changes' }).click()
    await expect(page.locator('#mta-sts-mode')).toHaveValue('testing')
    await expect(page.locator('#mta-sts-max-age')).toHaveValue('604800')
  })

  test('FR-053 leaving with unsaved changes asks first', async ({ page, mockApi }) => {
    await mockApi.use('dns-mta-sts')
    await openSection(page, 'example.org')
    await edit(page)
    await page.locator('#mta-sts-mode').selectOption('testing')
    await page.getByRole('main').getByRole('link', { name: 'DNS diagnostics', exact: true }).click()
    const dialog = page.getByRole('alertdialog', { name: 'Leave without saving?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Stay' }).click()
    await expect(page.locator('#mta-sts-mode')).toHaveValue('testing')
    await expect(page).toHaveURL(/\/domains\/example\.org$/)
  })

  test('Edge: hosts that differ only in letter case or a trailing dot are kept once', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-mta-sts')
    await openSection(page, 'example.org')
    await edit(page)
    await page.locator('#mta-sts-mx').fill('Mail.Example.org., mail.example.org, mx2.example.org')
    await save(page)
    await expect(section(page)).toContainText('Changes to object example.org have been saved')
    const patch = (await mockApi.requests()).find(
      (request) => request.operationId === 'updateMtaStsPolicy',
    )
    expect(patch?.body).toEqual({ mxHosts: ['Mail.Example.org', 'mx2.example.org'] })
  })

  test('Edge: a policy created elsewhere turns the set-up into a change', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-mta-sts')
    await openSection(page, 'example.net')
    await edit(page)
    await page.locator('#mta-sts-max-age').fill('86400')
    await mockApi.patch({ dns: { policies: { 'example.net': { mode: 'testing' } } } })
    await save(page)
    await expect(section(page)).toContainText('This domain already has an MTA-STS policy.')
    await save(page)
    await expect(section(page)).toContainText('Changes to object example.net have been saved')
    const operations = (await mockApi.requests())
      .map((request) => request.operationId)
      .filter((id) => id === 'createMtaStsPolicy' || id === 'updateMtaStsPolicy')
    expect(operations).toEqual(['createMtaStsPolicy', 'updateMtaStsPolicy'])
  })

  test('FR-022 a domain administrator manages the policy of their domain, without History', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-mta-sts', { signedInAs: 'reseller' })
    await openSection(page, 'example.org')
    await expect(section(page).getByRole('link', { name: 'History' })).toHaveCount(0)
    await openSection(page, 'example.net')
    await edit(page)
    await page.locator('#mta-sts-max-age').fill('604800')
    await save(page)
    await expect(section(page)).toContainText('Changes to object example.net have been saved')
  })

  test('FR-055 the address #mta-sts brings the section into view with the focus', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-mta-sts')
    await page.goto('domains/example.org#mta-sts')
    const heading = section(page).getByRole('heading', { level: 2, name: 'MTA-STS' })
    await expect(heading).toBeFocused({ timeout: FIRST_LOAD })
    await expect(heading).toBeInViewport()
  })
})
