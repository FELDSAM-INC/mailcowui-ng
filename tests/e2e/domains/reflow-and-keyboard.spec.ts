// UI 002 T103: reflow at 320 px and at 400 % zoom, landscape on phones, focus never hidden behind
// the sticky header or the sticky actions, no transition under reduced motion, and the main path of
// each story with the keyboard alone (FR-068, FR-071, SC-004, WCAG 1.4.10, 2.4.11).
import type { Page } from '@playwright/test'

import type { ScenarioOverrides } from '../../mocks/scenarios'
import { expect, test } from '../fixtures/test'
import { isNarrow, listReady } from './helpers'

interface Screen {
  name: string
  scenario: string
  path: string
  overrides?: ScenarioOverrides
  /** The heading that shows the screen is ready, when it is not the page's level-1 heading. */
  heading?: { level: number; name: string }
  /** Opens a dialog, a menu or an edit mode on the screen. */
  open?: (page: Page) => Promise<void>
}

const SCREENS: Screen[] = [
  { name: 'the domain list', scenario: 'domains-60', path: 'domains' },
  {
    name: 'the domain list in selection mode',
    scenario: 'bulk-mixed',
    path: 'domains',
    open: async (page) => {
      await page.getByRole('button', { name: 'Select', exact: true }).click()
      await page.getByRole('checkbox', { name: 'Select bulk-01.example' }).check()
      await expect(page.getByRole('region', { name: 'Bulk actions' })).toBeVisible()
    },
  },
  {
    name: 'the bulk deactivation',
    scenario: 'bulk-mixed',
    path: 'domains',
    open: async (page) => {
      await page.getByRole('button', { name: 'Select', exact: true }).click()
      await page.getByRole('checkbox', { name: 'Select bulk-01.example' }).check()
      await page
        .getByRole('region', { name: 'Bulk actions' })
        .getByRole('button', { name: 'Deactivate' })
        .click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
    },
  },
  {
    name: 'the deletion of a domain',
    scenario: 'domain-delete',
    path: 'domains',
    open: async (page) => {
      await page.getByRole('button', { name: 'Actions for gone.example' }).click()
      await page.getByRole('menuitem', { name: 'Remove' }).click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
    },
  },
  { name: 'the add domain form', scenario: 'domain-create', path: 'domains/-/new' },
  { name: 'a domain page', scenario: 'domains-60', path: 'domains/nearly.example' },
  {
    name: 'the "Edit domain" section',
    scenario: 'domain-edit',
    path: 'domains/edit.example?edit=domain',
    heading: { level: 2, name: 'Edit domain' },
  },
  {
    name: 'the footer section',
    scenario: 'footer',
    path: 'domains/footed.example?edit=footer',
    heading: { level: 2, name: 'Domain wide footer' },
  },
  { name: 'the template list', scenario: 'templates', path: 'domain-templates' },
  {
    name: 'the removal of a template',
    scenario: 'templates',
    path: 'domain-templates?q=small',
    open: async (page) => {
      await page.getByRole('button', { name: 'Remove: Small' }).click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
    },
  },
  { name: 'the add template form', scenario: 'templates', path: 'domain-templates/new' },
  { name: 'a template', scenario: 'templates', path: 'domain-templates/3' },
  {
    name: 'the history of a domain',
    scenario: 'audit-domain-records',
    path: 'audit-log?targetId=example.org',
  },
]

async function openScreen(
  page: Page,
  screen: Screen,
  mockApi: { use: (name: string, overrides?: ScenarioOverrides) => Promise<string> },
) {
  await mockApi.use(screen.scenario, screen.overrides)
  await page.goto(screen.path)
  await expect(readyHeading(page, screen)).toBeVisible()
  if (page.url().includes('/domains') && !page.url().includes('/domains/')) await listReady(page)
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

/**
 * The focused element when the sticky header (top) or a sticky action bar (bottom) covers it
 * completely, or null.
 */
async function obscuredFocus(page: Page): Promise<string | null> {
  // The app corrects the scroll position in the next frame where the browser does not.
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
    for (const bar of document.querySelectorAll('[data-sticky-save], [data-section-actions]')) {
      if (bar.contains(focused) || getComputedStyle(bar).position !== 'sticky') continue
      const area = bar.getBoundingClientRect()
      if (rect.top >= area.top && rect.bottom <= area.bottom) {
        return `${focused.tagName}#${focused.id} under the actions`
      }
    }
    return null
  })
}

test.describe('reflow, motion and focus', () => {
  // Every screen is opened twice and measured at several widths.
  test.slow(({ browserName }) => browserName === 'webkit', 'many layouts on WebKit')

  for (const screen of SCREENS) {
    test(`FR-068 SC-004 ${screen.name} reflows at 320 px and at 400 % zoom, and works in landscape`, async ({
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

    test(`FR-071 ${screen.name} runs no transition under reduced motion`, async ({
      page,
      mockApi,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await openScreen(page, screen, mockApi)
      expect(await longestMotion(page)).toBeLessThanOrEqual(0.001)
    })
  }

  for (const screen of SCREENS.filter((item) => !item.open)) {
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

test.describe('keyboard only', () => {
  test('a tag is added to the add domain form and removed again with the keyboard', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-create')
    await page.goto('domains/-/new')
    const tags = page.getByRole('combobox', { name: 'Tags' })
    await tags.focus()
    await page.keyboard.type('gold')
    await page.keyboard.press('Enter')
    const remove = page.getByRole('button', { name: 'Remove tag gold' })
    await expect(remove).toBeVisible()
    await remove.focus()
    await expect(remove).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(remove).toHaveCount(0)
  })

  test('an exclusion is chosen in the footer with the keyboard', async ({ page, mockApi }) => {
    await mockApi.use('footer')
    await page.goto('domains/plain.example?edit=footer')
    const select = page.getByLabel('Exclude from footer')
    // The addresses load after the form opens; ArrowDown on an empty list selects nothing.
    await expect(select.locator('option[value="a:info@plain.example"]')).toHaveCount(1)
    await select.focus()
    await expect(select).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect
      .poll(() =>
        select.evaluate((element) =>
          [...(element as HTMLSelectElement).selectedOptions].map((option) => option.value),
        ),
      )
      .toEqual(['a:info@plain.example'])
  })

  test('selection, sorting and a confirmation dialog with the keyboard; Escape returns the focus', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('bulk-mixed')
    await page.goto('domains')
    await listReady(page)
    const selectButton = page.getByRole('button', { name: 'Select', exact: true })
    await selectButton.focus()
    await page.keyboard.press('Enter')
    const checkbox = page.getByRole('checkbox', { name: 'Select bulk-01.example' })
    await checkbox.focus()
    await page.keyboard.press('Space')
    await expect(checkbox).toBeChecked()
    const deactivate = page
      .getByRole('region', { name: 'Bulk actions' })
      .getByRole('button', { name: 'Deactivate' })
    await deactivate.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(deactivate).toBeFocused()

    const sort = page.getByLabel('Sort by')
    await sort.focus()
    await sort.selectOption('createdAt')
    await expect(page).toHaveURL(/sort=createdAt/)
  })

  test('the deletion dialog opens from the row menu with the keyboard and takes the typed name', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-delete')
    await page.goto('domains')
    await listReady(page)
    const trigger = page.getByRole('button', { name: 'Actions for gone.example' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menuitem', { name: 'Remove' })).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    const typed = dialog.getByRole('textbox')
    for (
      let step = 0;
      step < 6 && !(await typed.evaluate((el) => el === document.activeElement));
      step++
    ) {
      await page.keyboard.press('Tab')
    }
    await expect(typed).toBeFocused()
    await page.keyboard.type('gone.example')
    await expect(dialog.getByRole('button', { name: 'Delete domain' })).toBeEnabled()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
})
