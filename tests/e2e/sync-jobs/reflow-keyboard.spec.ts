import { openBulkActions } from '../fixtures/flows'
// UI 008 reflow, motion, focus and keyboard (T074; FR-048, FR-050, SC-004, WCAG 1.4.10, 2.4.11):
// every screen and dialog of the feature reflows at 320 px and at 400 % zoom, works in landscape,
// runs no transition under reduced motion, never hides the focused element behind the sticky
// header, and the main path of each story completes with the keyboard alone.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { isNarrow, listReady } from './helpers'

interface Screen {
  name: string
  scenario: string
  path: string
  open?: (page: Page) => Promise<void>
}

const startSelection = async (page: Page) => {
  await listReady(page)
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.getByRole('checkbox', { name: /^Select user6@/ }).check()
}

const SCREENS: Screen[] = [
  { name: 'the list', scenario: 'sync-jobs-admin', path: 'sync-jobs' },
  { name: 'the job page', scenario: 'sync-jobs-admin', path: 'sync-jobs/17' },
  {
    name: 'the job page in edit mode',
    scenario: 'sync-jobs-admin',
    path: 'sync-jobs/17?edit=syncjob',
  },
  { name: 'the create form', scenario: 'sync-jobs-admin', path: 'sync-jobs/new' },
  {
    name: 'the selection bar',
    scenario: 'sync-jobs-bulk',
    path: 'sync-jobs?sort=id&order=asc',
    open: startSelection,
  },
  {
    name: 'the bulk summary',
    scenario: 'sync-jobs-bulk',
    path: 'sync-jobs?sort=id&order=asc',
    open: async (page) => {
      await startSelection(page)
      await (
        await openBulkActions(page)
      )
        .getByRole('button', { name: 'Activate', exact: true })
        .click()
      await expect(page.getByRole('region', { name: 'Results' })).toBeVisible()
    },
  },
  {
    name: 'the removal dialog',
    scenario: 'sync-jobs-admin',
    path: 'sync-jobs?q=long.example',
    open: async (page) => {
      await page
        .locator('[data-entry="17"]')
        .getByRole('button', { name: /^Actions for / })
        .click()
      await page.getByRole('menuitem', { name: 'Remove' }).click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
    },
  },
  {
    name: 'the log viewer',
    scenario: 'sync-jobs-admin',
    path: 'sync-jobs?log=20',
    open: async (page) => {
      await expect(page.getByRole('dialog')).toBeVisible()
    },
  },
]

async function openScreen(page: Page, screen: Screen, use: (name: string) => Promise<string>) {
  await use(screen.scenario)
  await page.goto(screen.path)
  if (screen.open) await screen.open(page)
  else await expect(page.getByRole('heading').first()).toBeVisible()
}

async function longestMotion(page: Page): Promise<number> {
  return page.evaluate(() => {
    const seconds = (value: string) =>
      Math.max(
        0,
        ...value.split(',').map((part) => {
          const text = part.trim()
          return text.endsWith('ms') ? parseFloat(text) / 1000 : parseFloat(text) || 0
        }),
      )
    let max = 0
    for (const element of document.querySelectorAll('*')) {
      const style = getComputedStyle(element)
      if (style.transitionProperty !== 'none')
        max = Math.max(max, seconds(style.transitionDuration))
      if (style.animationName !== 'none') max = Math.max(max, seconds(style.animationDuration))
    }
    return max
  })
}

for (const screen of SCREENS) {
  test(`FR-048 ${screen.name} reflows at 320 px and at 400 % zoom, and works in landscape`, async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    await openScreen(page, screen, (name) => mockApi.use(name))
    await expectNoHorizontalScroll(page, { widths: [320] })
    if (isNarrow(page)) {
      await page.setViewportSize({ width: 780, height: 360 })
      await expectNoHorizontalScroll(page, { widths: [780] })
    } else {
      await page.setViewportSize({ width: 320, height: 225 })
      await expectNoHorizontalScroll(page, { widths: [320] })
    }
  })

  test(`FR-050 ${screen.name} runs no transition under reduced motion`, async ({
    page,
    mockApi,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openScreen(page, screen, (name) => mockApi.use(name))
    expect(await longestMotion(page)).toBeLessThanOrEqual(0.001)
  })
}

for (const path of ['sync-jobs', 'sync-jobs/17?edit=syncjob', 'sync-jobs/new']) {
  test(`WCAG 2.4.11 the sticky header never hides the focused element on ${path}`, async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto(path)
    const start = page.getByRole('heading').first()
    await expect(start).toBeVisible()
    await start.focus()
    for (let step = 0; step < 30; step++) {
      await page.keyboard.press('Tab')
      const obscured = await page.evaluate(() => {
        const focused = document.activeElement
        const header = document.querySelector('header')
        if (!focused || !header || header.contains(focused) || focused === document.body)
          return null
        if (getComputedStyle(focused).position === 'fixed') return null
        const rect = focused.getBoundingClientRect()
        const bar = header.getBoundingClientRect()
        return rect.bottom <= bar.bottom ? (focused.textContent ?? focused.tagName).trim() : null
      })
      expect(obscured, 'a focused element hidden behind the sticky header').toBeNull()
    }
  })
}

/** Presses Tab until the focused element matches, then returns. */
async function tabTo(
  page: Page,
  matches: (el: { text: string; label: string; id: string }) => boolean,
) {
  for (let step = 0; step < 300; step++) {
    await page.keyboard.press('Tab')
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      return {
        text: (el?.textContent ?? '').trim(),
        label: el?.getAttribute('aria-label') ?? '',
        id: el?.id ?? '',
      }
    })
    if (matches(info)) return
  }
  throw new Error('focus target not reached with Tab')
}

test.describe('keyboard only', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard paths are checked on desktop')

  test('US1 US5 the list, a job and its log by keyboard', async ({ page, mockApi }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?q=previous')
    await listReady(page)
    await page.getByRole('heading', { level: 1 }).focus()
    await tabTo(page, (el) => el.label.startsWith('Actions for'))
    await page.keyboard.press('Enter')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('[data-row-action-trigger]').first()).toBeFocused()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/sync-jobs\/2$/)
  })

  test('US2 US3 creating and editing by keyboard', async ({ page, mockApi }) => {
    await mockApi.use('sync-jobs-user')
    await page.goto('sync-jobs/new')
    await page.locator('#syncjob-create-remoteHost').focus()
    await page.keyboard.type('imap.keys.example')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.type('keys.user')
    await page.keyboard.press('Tab')
    await page.keyboard.type('Keys-Secret')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/sync-jobs\/\d+$/)
    await page.getByRole('heading', { level: 1 }).focus()
    await tabTo(page, (el) => el.label === 'Edit Edit sync job')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/edit=syncjob/)
    await page.locator('#syncjob-intervalMinutes').focus()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('30')
    await page.keyboard.press('Enter')
    await expect(page).not.toHaveURL(/edit=/)
  })

  test('US4 US6 selecting, acting and removing by keyboard', async ({ page, mockApi }) => {
    await mockApi.use('sync-jobs-bulk')
    await page.goto('sync-jobs?sort=id&order=asc')
    await listReady(page)
    await page.getByRole('heading', { level: 1 }).focus()
    await tabTo(page, (el) => el.text === 'Select')
    await page.keyboard.press('Enter')
    await tabTo(page, (el) => el.label.startsWith('Select user1@'))
    await page.keyboard.press('Space')
    await tabTo(page, (el) => el.text === 'Schedule next')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('region', { name: 'Results' })).toContainText('1 done')
    await page.getByRole('heading', { level: 1 }).focus()
    await tabTo(page, (el) => el.label.startsWith('Actions for user2@'))
    await page.keyboard.press('Enter')
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    await expect(page.getByText('Deleted syncjob ID 2').first()).toBeVisible()
  })
})
