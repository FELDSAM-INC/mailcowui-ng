// UI013 T056: one reversible UI-text change on the coordinated isolated local stack.
import { expect, test } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import type { AuditEvent, PublicConfig, UiTexts } from '@/api'
import { csrfToken, requireLocalStack } from '../fixtures/account-api'
import { admin } from '../fixtures/accounts'
import { expectHome, signIn, signOut } from '../fixtures/flows'

test('@013 @local-stack administrator changes and restores the product name', async ({
  page,
  baseURL,
}, testInfo) => {
  requireLocalStack(baseURL)
  await signIn(page, admin.username, admin.password)
  await expectHome(page, admin.username)
  const response = await page.request.get('/api/v2/settings/ui-texts')
  expect(response.status()).toBe(200)
  const before = ((await response.json()) as { data: UiTexts }).data
  const productName = `Customize check ${Date.now()}`
  const startedAt = new Date(Date.now() - 1000).toISOString()
  try {
    await page.goto('system/customize/ui-texts')
    const names = page.locator('#section-names')
    await names.getByRole('button', { name: /^Edit / }).click()
    await page.locator('#ui-text-productName').fill(productName)
    await names.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(names.locator('form')).toHaveCount(0)
    await expect(names).toContainText(productName)
    const publicResponse = await page.request.get('/api/v2/public-config')
    expect(publicResponse.status()).toBe(200)
    expect(((await publicResponse.json()) as { data: PublicConfig }).data.productName).toBe(
      productName,
    )
    // Existing custom logos may replace visible header text; their accessible name must refresh.
    const logo = page.locator('header img, aside img').first()
    if (await logo.count()) await expect(logo).toHaveAttribute('alt', productName)
    else
      await expect(
        page.locator('header, aside').getByText(productName, { exact: true }).first(),
      ).toBeVisible()
  } finally {
    const read = await page.request.get('/api/v2/settings/ui-texts')
    expect(read.status()).toBe(200)
    const current = ((await read.json()) as { data: UiTexts }).data
    if (current.productName !== before.productName) {
      const restored = await page.request.patch('/api/v2/settings/ui-texts', {
        headers: {
          'X-CSRF-Token': await csrfToken(page),
          'If-Match': current.etag,
          'Content-Type': 'application/merge-patch+json',
        },
        data: { productName: before.productName },
      })
      expect(restored.status(), 'Restore the local stack product name').toBe(200)
      expect(((await restored.json()) as { data: UiTexts }).data.productName).toBe(
        before.productName,
      )
    }
  }
  const audit = await page.request.get('/api/v2/audit-events', {
    params: { targetType: 'uiTexts', from: startedAt, limit: 20 },
  })
  expect(audit.status()).toBe(200)
  const events = ((await audit.json()) as { data: AuditEvent[] }).data
  const event = events.find(
    (event) =>
      event.eventType === 'uiTextsUpdate' &&
      event.outcome === 'success' &&
      JSON.stringify(event.details.changes).includes(JSON.stringify(productName)) &&
      (event.details.changes as Record<string, { old: unknown; new: unknown }> | undefined)
        ?.productName?.new === productName,
  )
  expect(event, 'Successful product-name change is recorded in audit').toBeDefined()
  await writeFile(
    testInfo.outputPath('branding-audit-evidence.json'),
    JSON.stringify(
      {
        id: event!.id,
        requestId: event!.requestId,
        oldProductName: before.productName,
        newProductName: productName,
        occurredAt: event!.occurredAt,
      },
      null,
      2,
    ),
  )
  await signOut(page)
})
