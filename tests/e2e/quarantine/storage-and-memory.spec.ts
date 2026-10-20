import { expectDownload } from '../fixtures/downloads'
import { expect, test } from '../fixtures/test'
import { itemAction, openItem } from './helpers'

test('FR-085 message content and downloads stay out of browser persistence and history', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('quarantine-mailbox-user')
  const logged: string[] = []
  page.on('console', (message) => logged.push(message.text()))
  await openItem(page, 11)
  await expectDownload(page, () => itemAction(page, 'download'))
  await page.locator('[data-back-to-list]').click()
  await expect(page).toHaveURL(/\/quarantine$/)
  const snapshot = await page.evaluate(async () => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
    databases: await indexedDB.databases(),
    state: history.state,
    title: document.title,
    url: location.href,
  }))
  expect(snapshot.databases).toEqual([])
  for (const text of [JSON.stringify(snapshot), logged.join('\n')]) {
    expect(text).not.toContain('<script>alert(1)</script>')
    expect(text).not.toContain('https://phish.example/login')
  }
})
