import {
  aliceQuarantineItems,
  messageBytes,
  messageFileName,
} from '../../mocks/factories/quarantine-item'
import { expectDownload, expectNoDownload } from '../fixtures/downloads'
import { expect, test } from '../fixtures/test'
import { itemAction, openItem } from './helpers'

test('FR-036 downloads: attachment and whole message preserve bytes and never navigate', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('quarantine-mailbox-user')
  await openItem(page, 6)
  const attachment = await expectDownload(page, () =>
    page.locator('[data-attachment="0"] [data-attachment-download]').click(),
  )
  expect(attachment.fileName).toBe('report.pdf')
  expect(attachment.bytes.toString()).toBe('%PDF-1.4 report')
  const message = await expectDownload(page, () => itemAction(page, 'download'))
  const stored = aliceQuarantineItems().find((item) => item.id === 6)!
  expect(message.fileName.replaceAll('_', ' ')).toBe(messageFileName(stored))
  expect(message.bytes.equals(messageBytes(stored))).toBe(true)
})

test('FR-037 downloads: a virus warning can cancel without fetching a file', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('quarantine-mailbox-user')
  await openItem(page, 5)
  await page.locator('[data-attachment="0"] [data-attachment-download]').click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('contains a virus')
  await expectAccessible()
  await expectNoDownload(page, () =>
    dialog.getByRole('button', { name: 'Cancel', exact: true }).click(),
  )
  expect(
    (await mockApi.requests()).filter(
      (entry) => entry.operationId === 'downloadQuarantineAttachment',
    ),
  ).toHaveLength(0)
})

test('FR-038 downloads: a removed attachment or revoked permission gives a readable refusal', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('quarantine-mailbox-user')
  await openItem(page, 6)
  await mockApi.failNext('downloadQuarantineAttachment', { status: 404 })
  await expectNoDownload(page, () =>
    page.locator('[data-attachment="0"] [data-attachment-download]').click(),
  )
  await expect(page.getByRole('alert')).toBeVisible()
  await mockApi.setFlags('alice@example.org', { quarantineAttachments: false })
  await expectNoDownload(page, () =>
    page.locator('[data-attachment="0"] [data-attachment-download]').click(),
  )
  await expect(page.locator('#qitem-acl-quarantineAttachments')).toBeVisible()
  await expect(page.locator('[data-attachments]')).toHaveCount(0)
  await expectAccessible()
})
