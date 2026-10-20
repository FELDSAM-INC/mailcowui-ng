import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { MailboxClientConfiguration, RecentLogin } from '@/api'
import { requireLocalStack, signInAlice } from './fixtures/account-api'
import { alice } from './fixtures/accounts'
import { signOut } from './fixtures/flows'

test('@005 @local-stack US8 US9 alice sees recent connections and downloads a mail profile', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(90_000)
  requireLocalStack(baseURL)
  await signInAlice(page)
  await page.goto('account/recent-logins?days=31')
  const response = await page.request.get(
    `/api/v2/mailboxes/${encodeURIComponent(alice.username)}/recent-logins?days=31`,
  )
  expect(response.status()).toBe(200)
  const { data: entries } = (await response.json()) as { data: RecentLogin[] }
  expect(entries.some((entry) => entry.service === 'WEBUI')).toBe(true)
  const list = page.locator('[data-recent-logins]')
  await expect(list).toContainText('WEBUI')
  for (const entry of entries.slice(0, 25)) {
    await expect(list).toContainText(entry.clientAddress)
  }
  await page.goto('account/mail-apps')
  const configuration = await page.request.get('/api/v2/me/mailbox/client-configuration')
  expect(configuration.status()).toBe(200)
  const { data } = (await configuration.json()) as { data: MailboxClientConfiguration }
  const imap = page.locator('[data-protocol="imap"]')
  await expect(imap).toContainText(data.imap.host)
  if (data.imap.tlsPort !== null) await expect(imap).toContainText(String(data.imap.tlsPort))
  if (data.imap.starttlsPort !== null)
    await expect(imap).toContainText(String(data.imap.starttlsPort))
  const fileResponse = page.waitForResponse((result) =>
    result.url().includes('/me/mailbox/apple-profile'),
  )
  const waiting = page.waitForEvent('download')
  await page.locator('[data-profile-password="false"] [data-variant="email"]').click()
  const download = await waiting
  expect(download.suggestedFilename()).toMatch(/\.mobileconfig$/)
  expect(await download.failure()).toBeNull()
  const filePath = await download.path()
  expect(filePath).not.toBeNull()
  const content = await readFile(filePath, 'utf8')
  expect(content).toContain('<plist')
  expect(content).toContain(alice.username)
  expect(content).toContain('com.apple.mail.managed')
  const profile = await fileResponse
  expect(profile.status()).toBe(200)
  expect(profile.headers()['content-type']).toContain('application/x-apple-aspen-config')
  expect(profile.headers()['cache-control']).toContain('no-store')
  await signOut(page)
})
