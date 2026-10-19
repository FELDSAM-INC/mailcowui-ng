// UI 004 T107: every screen, dialog, picker and selection mode of feature 004, with the long values
// where they matter (SC-004): no horizontal scroll at 320 px or at 400 % zoom (FR-066), landscape on
// phones, the focused element never hidden behind the sticky header or a sticky action bar
// (WCAG 2.4.11), and no transition under reduced motion.
import type { Page } from '@playwright/test'

import { LONG_VALUES_004 } from '../../mocks/scenarios/aliases-list'
import { ALIAS_DOMAINS_SCENARIO } from '../../mocks/scenarios/alias-domains'
import { BULK_004 } from '../../mocks/scenarios/bulk-004'
import { EDIT_ALIAS_004 } from '../../mocks/scenarios/aliases-edit'
import { RESOURCES_004 } from '../../mocks/scenarios/resources'
import { expect, test } from '../fixtures/test'
import { isNarrow, listReady } from '../aliases/helpers'

interface Screen {
  name: string
  scenario: string
  path: string
  /** The heading that shows the screen is ready, when it is not the page's level-1 heading. */
  heading?: { level: number; name: string }
  list?: boolean
  /** Opens a dialog, a picker or a mode on the screen. */
  open?: (page: Page) => Promise<void>
}

const selectFirst = async (page: Page) => {
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.locator('[data-entry]').first().getByRole('checkbox').check()
  await expect(page.getByRole('region', { name: 'Bulk actions' })).toBeVisible()
}

const openMenuItem = (entry: string | number, item: string) => async (page: Page) => {
  await page
    .locator(`[data-entry="${entry}"]`)
    .getByRole('button', { name: /^Actions for/ })
    .click()
  await page.getByRole('menuitem', { name: item }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
}

const openPicker = (label: string, search: string) => async (page: Page) => {
  const field = page.getByRole('combobox', { name: label, exact: true })
  await field.click()
  await field.fill(search)
  await expect(page.getByRole('listbox', { name: label })).toBeVisible()
}

const SCREENS: Screen[] = [
  {
    name: 'the alias list with long values',
    scenario: 'aliases-long-values',
    path: 'aliases',
    list: true,
  },
  {
    name: 'the alias list in selection mode',
    scenario: 'bulk-004',
    path: 'aliases',
    list: true,
    open: selectFirst,
  },
  {
    name: 'the bulk deactivation of aliases',
    scenario: 'bulk-004',
    path: 'aliases',
    list: true,
    open: async (page) => {
      await selectFirst(page)
      await page
        .getByRole('region', { name: 'Bulk actions' })
        .getByRole('button', { name: 'Deactivate' })
        .click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
    },
  },
  {
    name: 'the deletion of an alias',
    scenario: 'aliases-edit',
    path: 'aliases',
    list: true,
    open: openMenuItem(EDIT_ALIAS_004.sales, 'Remove'),
  },
  {
    name: 'the expansion over alias domains',
    scenario: 'bulk-004',
    path: 'aliases?size=50',
    list: true,
    open: openMenuItem(BULK_004.sales, 'Expand alias over alias domains'),
  },
  { name: 'the add alias form', scenario: 'aliases-create', path: 'aliases/new' },
  {
    name: 'the long alias page',
    scenario: 'aliases-long-values',
    path: `aliases/${LONG_VALUES_004.long}`,
  },
  {
    name: 'the alias with 200 destinations',
    scenario: 'aliases-long-values',
    path: `aliases/${LONG_VALUES_004.many}`,
  },
  {
    name: 'the "Edit alias" section',
    scenario: 'aliases-edit',
    path: `aliases/${EDIT_ALIAS_004.sales}?edit=alias`,
    heading: { level: 2, name: 'Edit alias' },
  },
  {
    name: 'the domain alias list',
    scenario: 'alias-domains-admin',
    path: 'alias-domains',
    list: true,
  },
  {
    name: 'the add domain alias form',
    scenario: 'alias-domains-admin',
    path: 'alias-domains/-/new',
  },
  {
    name: 'the target domain picker',
    scenario: 'alias-domains-admin',
    path: 'alias-domains/-/new',
    open: openPicker('Target domain', 'example'),
  },
  {
    name: 'a domain alias page',
    scenario: 'alias-domains-admin',
    path: `alias-domains/${ALIAS_DOMAINS_SCENARIO.withAliases}`,
  },
  {
    name: 'the "Edit Alias domain" section',
    scenario: 'alias-domains-admin',
    path: `alias-domains/${ALIAS_DOMAINS_SCENARIO.withAliases}?edit=general`,
    heading: { level: 2, name: 'Edit Alias domain' },
  },
  { name: 'the resource list', scenario: 'resources', path: 'resources', list: true },
  { name: 'the add resource form', scenario: 'resources', path: 'resources/new' },
  {
    name: 'a resource page',
    scenario: 'resources',
    path: `resources/${RESOURCES_004.meetingRoom}`,
  },
  {
    name: 'the "Resource" section',
    scenario: 'resources',
    path: `resources/${RESOURCES_004.meetingRoom}?edit=resource`,
    heading: { level: 2, name: 'Resource' },
  },
  {
    name: 'the sender fields of the Mailbox section',
    scenario: 'sender-settings',
    path: 'mailboxes/anna@example.org?edit=mailbox',
    heading: { level: 2, name: 'Mailbox' },
  },
  {
    name: 'the "Allow to send as" picker',
    scenario: 'sender-settings',
    path: 'mailboxes/anna@example.org?edit=mailbox',
    heading: { level: 2, name: 'Mailbox' },
    open: openPicker('Allow to send as', 'info'),
  },
  {
    name: 'the history of an alias',
    scenario: 'history-004',
    path: 'audit-log?targetType=alias&targetId=1',
  },
]

async function openScreen(
  page: Page,
  screen: Screen,
  mockApi: { use: (name: string) => Promise<string> },
) {
  await mockApi.use(screen.scenario)
  await page.goto(screen.path)
  await expect(readyHeading(page, screen)).toBeVisible()
  if (screen.list) await listReady(page)
  await screen.open?.(page)
}

function readyHeading(page: Page, screen: Screen) {
  return screen.heading
    ? page.getByRole('heading', screen.heading)
    : page.getByRole('heading', { level: 1 }).first()
}

/** The longest transition or animation on the page, in seconds. */
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

/** The focused element when the sticky header, an action bar or the bulk bar covers it, or null. */
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
    const bars = document.querySelectorAll(
      '[data-sticky-save], [data-section-actions], [role="region"][aria-label="Bulk actions"]',
    )
    for (const bar of bars) {
      if (bar.contains(focused) || getComputedStyle(bar).position !== 'sticky') continue
      const area = bar.getBoundingClientRect()
      if (rect.top >= area.top && rect.bottom <= area.bottom) {
        return `${focused.tagName}#${focused.id} under a sticky bar`
      }
    }
    return null
  })
}

test.describe('feature 004: reflow, motion and focus', () => {
  test.slow(({ browserName }) => browserName === 'webkit', 'many layouts on WebKit')

  for (const screen of SCREENS) {
    test(`FR-066 SC-004 ${screen.name} reflows at 320 px and at 400 % zoom, and works in landscape`, async ({
      page,
      mockApi,
      expectNoHorizontalScroll,
    }) => {
      await openScreen(page, screen, mockApi)
      await expectNoHorizontalScroll(page, { widths: [320] })
      if (isNarrow(page)) {
        await page.setViewportSize({ width: 780, height: 360 })
        await expectNoHorizontalScroll(page, { widths: [780] })
      } else {
        // 400 % zoom of a 1280 px desktop window is 320 CSS px.
        await page.setViewportSize({ width: 320, height: 225 })
        await expectNoHorizontalScroll(page, { widths: [320] })
      }
    })

    test(`FR-066 ${screen.name} runs no transition under reduced motion`, async ({
      page,
      mockApi,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await openScreen(page, screen, mockApi)
      expect(await longestMotion(page)).toBeLessThanOrEqual(0.001)
    })
  }

  for (const screen of SCREENS.filter((item) => !item.open || item.name.includes('selection'))) {
    test(`WCAG 2.4.11 the sticky bars never hide the focused element on ${screen.name}`, async ({
      page,
      mockApi,
    }) => {
      await openScreen(page, screen, mockApi)
      await readyHeading(page, screen).focus()
      for (let step = 0; step < 25; step++) {
        await page.keyboard.press('Tab')
        expect(await obscuredFocus(page)).toBeNull()
      }
    })
  }
})
