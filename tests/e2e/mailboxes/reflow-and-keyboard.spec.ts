// UI 003 T125, a cross-story check: every mailbox screen reflows at 320 px and at 400 % zoom, runs
// no transition under reduced motion, and the list's main path works with the keyboard alone
// (FR-068, FR-070, FR-071, SC-004, WCAG 1.4.10).
import type { Page } from '@playwright/test'

import { isNarrow, listReady } from '../domains/helpers'
import { expect, test } from '../fixtures/test'

interface Screen {
  name: string
  scenario: string
  path: string
  ready: (page: Page) => Promise<void>
}

const heading = (name: string) => async (page: Page) => {
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

const SCREENS: Screen[] = [
  { name: 'the mailbox list', scenario: 'admin-mailboxes-30', path: 'mailboxes', ready: listReady },
  {
    name: 'the mailbox page',
    scenario: 'admin-edit',
    path: 'mailboxes/anna@a.example',
    ready: heading('Edit mailbox'),
  },
  {
    name: 'the add mailbox form',
    scenario: 'admin-create',
    path: 'mailboxes/new?domain=example.org',
    ready: heading('Add mailbox'),
  },
  {
    name: 'the mailbox templates',
    scenario: 'admin-templates',
    path: 'mailbox-templates',
    ready: listReady,
  },
]

async function longestMotion(page: Page): Promise<number> {
  return page.evaluate(() => {
    let longest = 0
    for (const element of document.querySelectorAll('*')) {
      const style = getComputedStyle(element)
      for (const value of [style.transitionDuration, style.animationDuration]) {
        for (const part of value.split(',')) longest = Math.max(longest, parseFloat(part) || 0)
      }
    }
    return longest
  })
}

test.describe('mailbox screens: reflow, motion and keyboard', () => {
  for (const screen of SCREENS) {
    test(`FR-068 ${screen.name} reflows at 320 px and at 400 % zoom`, async ({
      page,
      mockApi,
      expectNoHorizontalScroll,
    }) => {
      await mockApi.use(screen.scenario)
      await page.goto(screen.path)
      await screen.ready(page)
      await expectNoHorizontalScroll(page, { widths: [320] })
      if (!isNarrow(page)) {
        await page.setViewportSize({ width: 320, height: 225 })
        await expectNoHorizontalScroll(page, { widths: [320] })
      }
    })

    test(`FR-071 ${screen.name} runs no transition under reduced motion`, async ({
      page,
      mockApi,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await mockApi.use(screen.scenario)
      await page.goto(screen.path)
      await screen.ready(page)
      expect(await longestMotion(page)).toBeLessThanOrEqual(0.001)
    })
  }

  test('SC-004 FR-070 the list’s search and a mailbox open with the keyboard alone', async ({
    page,
    mockApi,
  }) => {
    test.skip(isNarrow(page), 'a physical keyboard is assumed on desktop')
    await mockApi.use('admin-mailboxes-30')
    await page.goto('mailboxes')
    await listReady(page)
    await page.getByRole('searchbox', { name: 'Search:' }).focus()
    await page.keyboard.type('carl')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/q=carl/)
    const link = page.locator('[data-entry="carl@a.example"]').getByRole('link', {
      name: 'carl@a.example',
      exact: true,
    })
    await expect(link).toBeVisible()
    for (let index = 0; index < 40; index += 1) {
      if (await link.evaluate((element) => element === document.activeElement)) break
      await page.keyboard.press('Tab')
    }
    await expect(link).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit mailbox' })).toBeVisible()
  })
})
