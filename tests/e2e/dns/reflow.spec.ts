// UI 010 T105: every DNS screen reflows at 320 px and at 400 % zoom with long names and values,
// works in landscape, keeps the focus clear of the sticky header and action bars, keeps the
// actions of its forms and dialogs visible at 360 px, and runs no transition under reduced motion
// (FR-079, FR-080, SC-005, WCAG 1.4.10, 2.4.11).
import type { Page } from '@playwright/test'

import { LONG_NAME } from '../../mocks/scenarios/dns'
import { expect, test } from '../fixtures/test'
import { FIRST_LOAD, isNarrow } from './helpers'

interface Screen {
  name: string
  scenario: string
  path: string
  heading?: { level: number; name: string }
  open?: (page: Page) => Promise<void>
  /** The actions that must be visible at 360 px without scrolling to the end (FR-080). */
  actions?: string
}

const SCREENS: Screen[] = [
  { name: 'the DKIM keys', scenario: 'dns-admin', path: 'dns/dkim-keys' },
  {
    name: 'the DKIM keys in selection mode',
    scenario: 'dns-admin',
    path: 'dns/dkim-keys',
    open: async (page) => {
      await page.getByRole('button', { name: 'Select', exact: true }).click()
      await page.getByRole('checkbox', { name: 'Select example.net' }).check()
    },
    actions: '[role="region"][aria-label="Bulk actions"]',
  },
  { name: 'a long DKIM entry', scenario: 'dns-admin', path: `dns/dkim-keys/${LONG_NAME}` },
  {
    name: 'the generation dialog',
    scenario: 'dns-admin',
    path: 'dns/dkim-keys/example.net',
    open: async (page) => {
      await page.getByRole('button', { name: 'Add ARC/DKIM key' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
    actions: '[data-dialog-actions]',
  },
  {
    name: 'the replacement dialog',
    scenario: 'dns-admin',
    path: 'dns/dkim-keys/example.org',
    open: async (page) => {
      await page.getByRole('button', { name: 'Replace with a new key' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
    actions: '[data-dialog-actions]',
  },
  {
    name: 'the import',
    scenario: 'dns-admin',
    path: 'dns/dkim-import',
    actions: '[data-sticky-save]',
  },
  {
    name: 'the copy',
    scenario: 'dns-admin',
    path: 'dns/dkim-keys/example.org/copy',
    actions: '[data-sticky-save]',
  },
  {
    name: 'the diagnostics',
    scenario: 'dns-diagnostics-markup',
    path: 'dns/diagnostics/example.org',
  },
  { name: 'the MTA-STS policies', scenario: 'dns-mta-sts', path: 'dns/mta-sts-policies' },
  {
    name: 'the domain page with its DNS sections',
    scenario: 'dns-mta-sts',
    path: 'domains/example.org',
  },
]

async function openScreen(page: Page, screen: Screen, use: (name: string) => Promise<string>) {
  await use(screen.scenario)
  await page.goto(screen.path)
  const heading = screen.heading
    ? page.getByRole('heading', screen.heading)
    : page.getByRole('heading', { level: 1 }).first()
  await expect(heading).toBeVisible({ timeout: FIRST_LOAD })
  await page.waitForLoadState('networkidle')
  await screen.open?.(page)
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

async function obscuredFocus(page: Page): Promise<string | null> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  return page.evaluate(() => {
    const focused = document.activeElement
    if (!focused || focused === document.body) return null
    if (getComputedStyle(focused).position === 'fixed') return null
    const header = document.querySelector('header')
    if (header?.contains(focused)) return null
    const rect = focused.getBoundingClientRect()
    if (header && rect.bottom <= header.getBoundingClientRect().bottom) {
      return `${focused.tagName} ${(focused.textContent ?? '').trim()} under the header`
    }
    for (const bar of document.querySelectorAll(
      '[data-sticky-save], [data-section-actions], [role="region"][aria-label="Bulk actions"]',
    )) {
      if (bar.contains(focused) || getComputedStyle(bar).position !== 'sticky') continue
      const area = bar.getBoundingClientRect()
      if (rect.top >= area.top && rect.bottom <= area.bottom) {
        return `${focused.tagName}#${focused.id} under the actions`
      }
    }
    return null
  })
}

test.describe('DNS reflow, motion and focus', () => {
  test.slow()

  for (const screen of SCREENS) {
    test(`SC-005 ${screen.name} reflows at 320 px and at 400 % zoom, and works in landscape`, async ({
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

    test(`FR-079 ${screen.name} runs no transition under reduced motion`, async ({
      page,
      mockApi,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await openScreen(page, screen, (name) => mockApi.use(name))
      expect(await longestMotion(page)).toBeLessThanOrEqual(0.001)
    })
  }

  for (const screen of SCREENS.filter((item) => item.actions)) {
    test(`FR-080 the actions of ${screen.name} are visible at 360 px`, async ({
      page,
      mockApi,
    }) => {
      await page.setViewportSize({ width: 360, height: 640 })
      await openScreen(page, screen, (name) => mockApi.use(name))
      await expect(page.locator(screen.actions!).first()).toBeInViewport()
    })
  }

  for (const screen of SCREENS.filter((item) => !item.open)) {
    test(`WCAG 2.4.11 the sticky bars never hide the focused element on ${screen.name}`, async ({
      page,
      mockApi,
    }) => {
      await openScreen(page, screen, (name) => mockApi.use(name))
      await page.getByRole('heading', { level: 1 }).first().focus()
      for (let step = 0; step < 20; step++) {
        await page.keyboard.press('Tab')
        expect(await obscuredFocus(page)).toBeNull()
      }
    })
  }
})
