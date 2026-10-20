// Read the event from the separate reversible branding smoke; do not mutate settings again.
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { AuditEvent } from '@/api'
import { requireLocalStack } from '../fixtures/account-api'
import { admin } from '../fixtures/accounts'
import { expectHome, signIn } from '../fixtures/flows'

test('@013 @local-stack UI text history shows the real branding change', async ({
  page,
  baseURL,
}) => {
  requireLocalStack(baseURL)
  const evidencePath = process.env.SMOKE_UI_TEXT_AUDIT_EVIDENCE
  test.skip(!evidencePath, 'Run the reversible branding smoke and provide its audit evidence file')
  const evidence = JSON.parse(await readFile(evidencePath!, 'utf8')) as {
    id: string
    requestId: string
    oldProductName: string | null
    newProductName: string
    occurredAt: string
  }
  expect(evidence.id).toBeTruthy()
  expect(evidence.requestId).toBeTruthy()
  await signIn(page, admin.username, admin.password)
  await expectHome(page, admin.username)
  const filters = new URLSearchParams({
    targetType: 'uiTexts',
    requestId: evidence.requestId,
  })
  const response = await page.request.get(`/api/v2/audit-events?${filters}`)
  expect(response.status()).toBe(200)
  const records = ((await response.json()) as { data: AuditEvent[] }).data
  const record = records.find((event) => event.id === evidence.id)
  expect(record?.eventType).toBe('uiTextsUpdate')
  expect(record?.outcome).toBe('success')
  expect(record?.details.changes).toMatchObject({
    productName: { old: evidence.oldProductName, new: evidence.newProductName },
  })
  await page.goto('audit-log?targetType=uiTexts')
  const expand = page.locator(`button[aria-controls="audit-details-${evidence.id}"]`)
  const row = page.locator('[data-record]').filter({ has: expand })
  await expect(row).toContainText('UI labels and texts changed')
  await expand.click()
  const details = page.locator(`#audit-details-${evidence.id}`)
  await expect(details).toBeVisible()
  await expect(details).toContainText(evidence.newProductName)
  await expect(details).toContainText('→')
  if (evidence.oldProductName) await expect(details).toContainText(evidence.oldProductName)
  await expect(row.locator('time')).toHaveAttribute(
    'datetime',
    new Date(evidence.occurredAt).toISOString(),
  )
})
