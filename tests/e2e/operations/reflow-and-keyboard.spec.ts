// UI 011 (T143; FR-079, FR-082, FR-084, SC-009; WCAG 1.4.10, 2.4.11, 2.3.3): every screen, dialog
// and viewer of the feature reflows at 320 px and at 400 % zoom, runs no transition or animation
// under reduced motion, never hides the focused element behind the sticky header, and each story's
// main path completes with the keyboard alone.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'

interface Screen {
  name: string
  scenario: string
  path: string
  open?: (page: Page) => Promise<void>
}

const wideEnough = (page: Page) => (page.viewportSize()?.width ?? 0) >= 768

const SCREENS: Screen[] = [
  {
    name: 'the dashboard',
    scenario: 'admin-operations',
    path: 'operations/dashboard',
    open: (page) => expect(page.locator('[data-hostname]')).toBeVisible({ timeout: 15_000 }),
  },
  {
    name: 'an expanded container',
    scenario: 'admin-operations',
    path: 'operations/containers/sogo-mailcow',
    open: (page) =>
      expect(page.locator('[data-container="sogo-mailcow"] [data-container-details]')).toBeVisible({
        timeout: 15_000,
      }),
  },
  {
    name: 'the restart dialog',
    scenario: 'admin-operations',
    path: 'operations/containers/postfix-mailcow',
    open: async (page) => {
      const card = page.locator('[data-container="postfix-mailcow"]')
      await card.getByRole('button', { name: 'Restart', exact: true }).click({ timeout: 15_000 })
      await expect(page.getByRole('alertdialog')).toBeVisible()
    },
  },
  {
    name: 'the release notes',
    scenario: 'admin-operations',
    path: 'operations/dashboard',
    open: async (page) => {
      await page
        .locator('[data-update-status="updateAvailable"]')
        .getByRole('button', { name: '2026-10' })
        .click({ timeout: 15_000 })
      await expect(page.getByRole('dialog')).toBeVisible()
    },
  },
  {
    name: 'a log with a 2,000-character token',
    scenario: 'ops-logs-large',
    path: 'operations/logs/postfix',
    open: (page) => expect(page.locator('[data-entry]').first()).toBeVisible({ timeout: 15_000 }),
  },
  {
    name: 'the rate limit reset',
    scenario: 'ops-rate-limits',
    path: 'operations/logs/rate-limits',
    open: async (page) => {
      await page
        .locator('[data-entry="rate-limits-39"]')
        .getByRole('button', { name: 'Remove hash' })
        .click({ timeout: 15_000 })
      await expect(page.getByRole('alertdialog')).toBeVisible()
    },
  },
  {
    name: 'Rspamd',
    scenario: 'admin-operations',
    path: 'operations/logs/rspamd',
    open: (page) =>
      expect(page.getByRole('heading', { level: 1, name: 'Rspamd history' })).toBeVisible({
        timeout: 15_000,
      }),
  },
  {
    name: 'the mail queue',
    scenario: 'ops-queue',
    path: 'operations/mail-queue',
    open: (page) => expect(page.locator('[data-entry]').first()).toBeVisible({ timeout: 15_000 }),
  },
  {
    name: 'the delete all dialog',
    scenario: 'ops-queue',
    path: 'operations/mail-queue',
    open: async (page) => {
      await page.getByRole('button', { name: 'Delete all' }).click({ timeout: 15_000 })
      await expect(page.getByRole('alertdialog')).toBeVisible()
    },
  },
  {
    name: 'the message viewer',
    scenario: 'ops-queue',
    path: 'operations/mail-queue/messages/4F2A1B3C9D',
    open: (page) => expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 }),
  },
  {
    name: 'the Fail2ban panel',
    scenario: 'ops-fail2ban',
    path: 'operations/fail2ban',
    open: (page) => expect(page.locator('[data-parameters]')).toBeVisible({ timeout: 15_000 }),
  },
  {
    name: 'the Fail2ban parameters form',
    scenario: 'ops-fail2ban',
    path: 'operations/fail2ban?edit=parameters',
    open: (page) =>
      expect(page.getByLabel('Ban time (s)', { exact: true })).toBeVisible({ timeout: 15_000 }),
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

test.describe('reflow, motion and keyboard @operations', () => {
  for (const screen of SCREENS) {
    test(`FR-079 SC-009 ${screen.name} reflows at 320 px and at 400 % zoom`, async ({
      page,
      mockApi,
      expectNoHorizontalScroll,
    }) => {
      await openScreen(page, screen, (name) => mockApi.use(name))
      await expectNoHorizontalScroll(page, { widths: [320] })
      if (wideEnough(page)) {
        // 400 % zoom on a 1,280 px wide screen: 320 × 225 CSS px.
        await page.setViewportSize({ width: 320, height: 225 })
        await expectNoHorizontalScroll(page, { widths: [320] })
      }
    })

    test(`FR-084 ${screen.name} runs no transition or animation under reduced motion`, async ({
      page,
      mockApi,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await openScreen(page, screen, (name) => mockApi.use(name))
      expect(await longestMotion(page)).toBeLessThanOrEqual(0.001)
    })
  }

  for (const [scenario, path] of [
    ['admin-operations', 'operations/dashboard'],
    ['ops-logs-large', 'operations/logs/postfix'],
    ['ops-queue', 'operations/mail-queue'],
    ['ops-fail2ban', 'operations/fail2ban'],
  ] as const) {
    test(`WCAG 2.4.11 the sticky header never hides the focused element on ${path}`, async ({
      page,
      mockApi,
    }) => {
      await mockApi.use(scenario)
      await page.goto(path)
      const start = page.getByRole('heading', { level: 1 })
      await expect(start).toBeVisible({ timeout: 15_000 })
      await start.focus()
      for (let step = 0; step < 40; step++) {
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
})

/** Presses Tab until the focused element matches. */
async function tabTo(
  page: Page,
  matches: (el: { text: string; label: string; type: string }) => boolean,
) {
  for (let step = 0; step < 400; step++) {
    await page.keyboard.press('Tab')
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      return {
        text: (el?.textContent ?? '').trim(),
        label: el?.getAttribute('aria-label') ?? '',
        type: el?.getAttribute('type') ?? '',
      }
    })
    if (matches(info)) return
  }
  throw new Error('focus target not reached with Tab')
}

test.describe('keyboard only @operations', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard paths are checked on desktop')

  test('FR-082 US1 US2 a container is expanded and restarted by keyboard', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-operations')
    await page.goto('operations/dashboard')
    await expect(page.locator('[data-hostname]')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('heading', { level: 1 }).focus()
    await tabTo(page, (el) => el.label === 'Show details of postfix-mailcow')
    await page.keyboard.press('Enter')
    await tabTo(page, (el) => el.text === 'Restart')
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await page.keyboard.press('Enter')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Restart now' }).focus()
    await page.keyboard.press('Enter')
    await expect(
      page.locator('[data-container="postfix-mailcow"] [data-action-outcome]'),
    ).toBeVisible()
  })

  test('FR-082 US3 a log entry opens its details and loads more by keyboard', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('ops-logs-large')
    await page.goto('operations/logs/postfix')
    await expect(page.locator('[data-entry]').first()).toBeVisible({ timeout: 15_000 })
    await page.getByRole('heading', { level: 1 }).focus()
    await tabTo(page, (el) => el.text === 'Actions')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-load-outcome]')).toContainText('additional rows were added')
  })

  test('FR-082 US4 queued messages are held by keyboard', async ({ page, mockApi }) => {
    await mockApi.use('ops-queue')
    await page.goto('operations/mail-queue')
    await expect(page.locator('[data-entry]').first()).toBeVisible({ timeout: 15_000 })
    await page.getByRole('heading', { level: 1 }).focus()
    await tabTo(page, (el) => el.text === 'Select')
    await page.keyboard.press('Enter')
    await tabTo(page, (el) => el.type === 'checkbox')
    await page.keyboard.press('Space')
    await tabTo(page, (el) => el.text === 'Hold')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('region', { name: 'Results' })).toBeVisible()
  })

  test('FR-082 US5 a ban is lifted by keyboard', async ({ page, mockApi }) => {
    await mockApi.use('ops-fail2ban')
    await page.goto('operations/fail2ban')
    const ban = page.locator('[data-ban="203.0.113.0/24"]')
    await expect(ban).toBeVisible({ timeout: 15_000 })
    await page.getByRole('heading', { level: 1 }).focus()
    await tabTo(page, (el) => el.text === 'unban')
    await page.keyboard.press('Enter')
    await expect(ban).toContainText('unban pending')
  })
})
