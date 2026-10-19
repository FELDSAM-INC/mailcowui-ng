// UI 011 US7 (T127): the update status next to the version, release notes shown safely (nothing
// loaded from elsewhere), and "Show public IP" when the IP check is enabled.
import { expect, test } from '../fixtures/test'
import { openDashboard } from './dashboard-helpers'

test.describe('updates and public addresses @operations', () => {
  test('US7-AS1 US7-AS5 FR-028 an available update opens its notes safely, without any request elsewhere', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('admin-operations')
    await openDashboard(page)
    const status = page.locator('[data-update-status="updateAvailable"]')
    await expect(status).toContainText('There is an update available')
    const foreign: string[] = []
    page.on('request', (request) => {
      if (!request.url().startsWith(new URL(page.url()).origin)) foreign.push(request.url())
    })
    await status.getByRole('button', { name: '2026-10' }).click()
    const dialog = page.getByRole('dialog', { name: 'New Release 2026-10' })
    await expect(dialog).toBeVisible()
    const notes = dialog.locator('[data-release-notes]')
    await expect(notes.getByRole('heading', { name: 'Highlights' })).toBeVisible()
    await expect(notes.getByRole('table')).toBeVisible()
    await expect(notes.locator('img, script, iframe')).toHaveCount(0)
    await expect(notes).toContainText('<script>window.__releaseNotesScript = true</script>')
    const image = notes.getByRole('link', { name: /^Image: Release diagram/ })
    await expect(image).toHaveAttribute('href', 'https://images.example.net/diagram.png')
    await expect(image).toHaveAttribute('target', '_blank')
    await expect(image).toHaveAttribute('rel', 'noopener noreferrer nofollow')
    await expect(notes.getByRole('link', { name: /Click me/ })).toHaveCount(0)
    await expect(dialog.getByRole('link', { name: /^2026-10/ })).toHaveAttribute(
      'href',
      'https://github.com/mailcow/mailcow-dockerized/releases/tag/2026-10',
    )
    expect(
      await page.evaluate(() => ({
        script: (window as unknown as Record<string, unknown>).__releaseNotesScript,
        onerror: (window as unknown as Record<string, unknown>).__releaseNotesOnerror,
      })),
    ).toEqual({ script: undefined, onerror: undefined })
    const box = await dialog.boundingBox()
    const viewport = page.viewportSize()!
    if (viewport.width < 768) expect(box?.width).toBeGreaterThanOrEqual(viewport.width - 1)
    else expect(box?.width).toBeLessThan(viewport.width)
    await expectAccessible()
    await expectNoHorizontalScroll()
    expect(foreign).toEqual([])
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)

    await page.locator('[data-version]').getByRole('button', { name: '2026-09a' }).click()
    await expect(page.getByRole('dialog', { name: 'Version 2026-09a' })).toContainText(
      'Fixes in the Fail2ban parameters.',
    )
  })

  test('US7-AS2 a failed check blocks nothing; a disabled check shows only the version', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('ops-update-check-failed')
    await openDashboard(page)
    await expect(page.locator('[data-update-status]')).toHaveText('Could not check for an Update')
    await expect(page.locator('[data-hostname]')).toBeVisible()
    await mockApi.use('ops-update-disabled')
    await openDashboard(page)
    await expect(page.locator('[data-version]')).toHaveText('2026-09a')
    await mockApi.use('ops-update-up-to-date')
    await openDashboard(page)
    await expect(page.locator('[data-update-status]')).toHaveText(
      'The System is on the latest version',
    )
  })

  test('US7-AS3 "Show public IP" shows progress, then both addresses or "-"', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('ops-ip-partial')
    await openDashboard(page)
    const ips = page.locator('[data-public-addresses]')
    await ips.getByRole('button', { name: 'Show public IP' }).click()
    await expect(ips.locator('[data-ipv4]')).toHaveText('203.0.113.10')
    await expect(ips.locator('[data-ipv6]')).toHaveText('-')
    await expectAccessible()
  })

  test('US7-AS4 the IP check switched off is explained, also when it was switched off meanwhile', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('ops-ip-check-disabled')
    await openDashboard(page)
    const ips = page.locator('[data-public-addresses]')
    await expect(ips).toContainText('IP check is disabled')
    await expect(ips.getByRole('button')).toHaveCount(0)
    await expectAccessible()
    await mockApi.use('ops-ip-disabled-meanwhile')
    await openDashboard(page)
    await ips.getByRole('button', { name: 'Show public IP' }).click()
    await expect(ips).toContainText('IP check is disabled')
  })
})
