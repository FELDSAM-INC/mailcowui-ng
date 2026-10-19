// UI 009 T115: every routing screen, form, dialog, picker, test page and section reflows at 320 px
// and at 400 % zoom, works in landscape on phones, never hides the focused element behind the
// sticky header or the sticky action bar, and runs no transition under reduced motion; long hosts,
// regular expressions, BCC destinations, TLS parameters and transcript lines wrap; and the main
// path of each user story completes with the keyboard alone (FR-068, spec edge case "Long values").
import type { Locator, Page } from '@playwright/test'

import type { ScenarioOverrides } from '../../mocks/scenarios'
import { expect, test } from '../fixtures/test'
import { entry, isNarrow, listReady, polite } from './helpers'

const LONG_LABEL = 'a-very-long-label-without-any-break-that-keeps-going-and-going'
const LONG_HOST = `[${LONG_LABEL}.${LONG_LABEL}.example]:587`

/** Long values in every list (spec edge case "Long values"). */
const LONG: ScenarioOverrides = {
  routing: {
    relayhosts: { add: [{ id: 40, host: LONG_HOST, username: `${LONG_LABEL}@example.org` }] },
    transports: {
      add: [
        {
          id: 40,
          destination: `/^(${LONG_LABEL}|${LONG_LABEL})\\.example\\.(org|net|com)$/`,
          nextHop: LONG_HOST,
        },
      ],
    },
    bccMaps: {
      add: [
        {
          id: 40,
          localDestination: '@example.org',
          type: 'sender',
          bccDestination: `${LONG_LABEL}@${LONG_LABEL}.example`,
        },
      ],
    },
    recipientMaps: {
      add: [
        {
          id: 40,
          originalDestination: `${LONG_LABEL}@example.org`,
          newDestination: `${LONG_LABEL}@${LONG_LABEL}.example`,
        },
      ],
    },
    tlsPolicyMaps: {
      add: [
        {
          id: 40,
          destination: `${LONG_LABEL}.example`,
          policy: 'fingerprint',
          parameters: `match=${'AB:'.repeat(40)}CD protocols=!SSLv2,!SSLv3,!TLSv1,!TLSv1.1`,
        },
      ],
    },
  },
}

interface Screen {
  name: string
  scenario: string
  overrides?: ScenarioOverrides
  path: string
  /** What shows that the screen is ready (default: the level-1 heading). */
  ready?: (page: Page) => Locator
  /** Opens a dialog, a picker or a result on the screen. */
  open?: (page: Page) => Promise<void>
}

const assignmentField = (page: Page) =>
  page.getByRole('combobox', { name: 'Sender-dependent transports' })

const SCREENS: Screen[] = [
  { name: 'the routing index', scenario: 'routing-admin-default', path: 'routing' },
  {
    name: 'the relayhost list',
    scenario: 'routing-admin-default',
    overrides: LONG,
    path: 'routing/relayhosts',
  },
  {
    name: 'the relayhost list in selection mode',
    scenario: 'routing-admin-default',
    path: 'routing/relayhosts',
    open: async (page) => {
      await page.getByRole('button', { name: 'Select', exact: true }).click()
      await entry(page, 2).getByRole('checkbox').check()
      await expect(page.getByRole('region', { name: 'Bulk actions' })).toBeVisible()
    },
  },
  {
    name: 'the deletion of a relayhost',
    scenario: 'routing-admin-default',
    path: 'routing/relayhosts',
    open: async (page) => {
      await entry(page, 1)
        .getByRole('button', { name: /^Remove: / })
        .click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
    },
  },
  {
    name: 'the add relayhost form',
    scenario: 'routing-admin-default',
    path: 'routing/relayhosts/new',
  },
  {
    name: 'a relayhost with a long host',
    scenario: 'routing-admin-default',
    overrides: LONG,
    path: 'routing/relayhosts/40',
  },
  {
    name: 'the usage of a relayhost',
    scenario: 'routing-admin-default',
    path: 'routing/relayhosts/1/usage',
  },
  {
    name: 'the transport list',
    scenario: 'routing-admin-default',
    overrides: LONG,
    path: 'routing/transports',
  },
  {
    name: 'the add transport form',
    scenario: 'routing-admin-default',
    path: 'routing/transports/new',
  },
  {
    name: 'a transport with a regular expression',
    scenario: 'routing-admin-default',
    overrides: LONG,
    path: 'routing/transports/40',
  },
  {
    name: 'the connection test form',
    scenario: 'routing-tests',
    path: 'routing/relayhosts/1/test',
  },
  {
    name: 'the longest transcript',
    scenario: 'routing-tests',
    path: 'routing/transports/21/test',
    open: async (page) => {
      await page.getByRole('button', { name: 'Run test' }).click()
      if (isNarrow(page)) await page.getByRole('button', { name: /Transcript/ }).click()
      await expect(page.locator('[data-transcript] li')).toHaveCount(501)
    },
  },
  {
    name: 'the BCC map list',
    scenario: 'routing-admin-default',
    overrides: LONG,
    path: 'routing/bcc-maps',
  },
  {
    name: 'the BCC destination picker',
    scenario: 'routing-admin-default',
    path: 'routing/bcc-maps/new',
    open: async (page) => {
      await page.getByRole('combobox', { name: 'Local destination' }).fill('example')
      await expect(page.getByRole('option').first()).toBeVisible()
    },
  },
  {
    name: 'the recipient map list',
    scenario: 'routing-admin-default',
    overrides: LONG,
    path: 'routing/recipient-maps',
  },
  {
    name: 'a recipient map with long addresses',
    scenario: 'routing-admin-default',
    overrides: LONG,
    path: 'routing/recipient-maps/40',
  },
  {
    name: 'the TLS policy map list',
    scenario: 'routing-admin-default',
    overrides: LONG,
    path: 'routing/tls-policy-maps',
  },
  {
    name: 'the add TLS policy map form',
    scenario: 'routing-admin-default',
    path: 'routing/tls-policy-maps/new',
  },
  {
    name: 'the forwarding host list',
    scenario: 'routing-admin-default',
    path: 'routing/forwarding-hosts',
  },
  {
    name: 'the add forwarding host form',
    scenario: 'routing-admin-default',
    path: 'routing/forwarding-hosts/new',
  },
  {
    name: 'the relayhost of a domain',
    scenario: 'routing-assignments',
    path: 'domains/example.org?edit=domain',
    ready: (page) => page.getByRole('heading', { level: 2, name: 'Edit domain' }),
  },
  {
    name: 'the relayhost choice',
    scenario: 'routing-assignments',
    path: 'domains/example.org?edit=domain',
    ready: (page) => page.getByRole('heading', { level: 2, name: 'Edit domain' }),
    open: async (page) => {
      await assignmentField(page).click()
      await expect(page.getByRole('option').first()).toBeVisible()
    },
  },
  {
    name: 'the relayhost of a mailbox',
    scenario: 'routing-assignments',
    path: 'mailboxes/alice@example.org?edit=mailbox',
    ready: (page) => page.locator('[data-relayhost-field]'),
  },
]

async function openScreen(
  page: Page,
  screen: Screen,
  mockApi: { use: (name: string, overrides?: ScenarioOverrides) => Promise<string> },
) {
  await mockApi.use(screen.scenario, screen.overrides)
  await page.goto(screen.path)
  await expect(readyLocator(page, screen)).toBeVisible()
  if (await page.locator('[data-list-state]').count()) await listReady(page)
  await screen.open?.(page)
}

function readyLocator(page: Page, screen: Screen): Locator {
  return screen.ready?.(page) ?? page.getByRole('heading', { level: 1 }).first()
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
      // Covered: inside the bar's band and beside it horizontally (the desktop navigation sits
      // next to the main column's bar, not under it).
      const beside = rect.right <= area.left || rect.left >= area.right
      if (!beside && rect.top >= area.top && rect.bottom <= area.bottom) {
        return `${focused.tagName}#${focused.id} under the actions`
      }
    }
    return null
  })
}

test.describe('reflow, motion and focus', () => {
  test.slow(({ browserName }) => browserName === 'webkit', 'many layouts on WebKit')

  for (const screen of SCREENS) {
    test(`FR-068 ${screen.name} reflows at 320 px and at 400 % zoom, and works in landscape`, async ({
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

    test(`FR-068 ${screen.name} runs no transition under reduced motion`, async ({
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
      await readyLocator(page, screen).focus()
      for (let step = 0; step < 25; step++) {
        await page.keyboard.press('Tab')
        expect(await obscuredFocus(page)).toBeNull()
      }
    })
  }
})

/** Moves the focus forward with Tab until the locator has it. */
async function tabTo(page: Page, target: Locator, limit = 40) {
  for (let step = 0; step < limit; step++) {
    if (await target.evaluate((element) => element === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  await expect(target).toBeFocused()
}

test.describe('keyboard only', () => {
  test('US1 a relayhost is added with the keyboard alone', async ({ page, mockApi }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/relayhosts')
    await listReady(page)
    const add = page.locator('[data-add]')
    await tabTo(page, add)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/routing\/relayhosts\/new$/)
    const host = page.getByLabel('Host', { exact: true })
    await expect(host).toBeVisible()
    await tabTo(page, host)
    await page.keyboard.type('[keyboard.example]:587')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/routing\/relayhosts$/)
    await expect(polite(page)).toContainText('[keyboard.example]:587')
  })

  test('US2 a relayhost is chosen for a domain and saved with the keyboard alone', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-assignments')
    await page.goto('domains/example.org?edit=domain')
    await expect(page.getByRole('heading', { level: 2, name: 'Edit domain' })).toBeVisible()
    const field = assignmentField(page)
    await field.focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('option', { name: /ID 2:/ })).toBeVisible()
    await page.keyboard.type('relay.example.com')
    await expect(page.getByRole('option', { name: /ID 2:/ })).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(field).toHaveValue(/ID 2:/)
    const save = page.getByRole('button', { name: 'Save changes', exact: true }).first()
    await tabTo(page, save, 80)
    await page.keyboard.press('Enter')
    await expect(polite(page)).toContainText('example.org')
  })

  test('US3 a transport is added with the keyboard alone', async ({ page, mockApi }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/transports/new')
    const destination = page.getByLabel('Destination', { exact: true })
    await tabTo(page, destination)
    await page.keyboard.type('keyboard.example')
    await tabTo(page, page.getByLabel('Next hop', { exact: true }))
    await page.keyboard.type('[relay.keyboard.example]:25')
    await tabTo(page, page.getByRole('button', { name: 'Add', exact: true }))
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/routing\/transports$/)
  })

  test('US4 a connection test runs with the keyboard alone', async ({ page, mockApi }) => {
    await mockApi.use('routing-tests')
    await page.goto('routing/relayhosts/1/test')
    const run = page.getByRole('button', { name: 'Run test' })
    await tabTo(page, run)
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('region', { name: 'Test result' }).getByRole('heading', { name: 'Accepted' }),
    ).toBeVisible()
  })

  test('US5 a BCC map is added from the picker with the keyboard alone', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/bcc-maps/new')
    const picker = page.getByRole('combobox', { name: 'Local destination' })
    await tabTo(page, picker)
    await page.keyboard.type('sales')
    await expect(page.getByRole('option', { name: /sales@example.org/ })).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(picker).toHaveValue(/sales@example.org/)
    await tabTo(page, page.getByLabel('BCC destination'))
    await page.keyboard.type('copies@archive.example')
    await tabTo(page, page.getByRole('button', { name: 'Add', exact: true }))
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/routing\/bcc-maps$/)
    await expect(polite(page)).toContainText('BCC map entry saved')
  })

  test('US6 US7 US8 TLS policy maps, recipient maps and forwarding hosts are added with Enter', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/tls-policy-maps/new')
    await tabTo(page, page.getByLabel('Destination'))
    await page.keyboard.type('keyboard.example')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/routing\/tls-policy-maps$/)

    await page.goto('routing/recipient-maps/new')
    await tabTo(page, page.getByLabel('Original recipient'))
    await page.keyboard.type('old@keyboard.example')
    await tabTo(page, page.getByLabel('New recipient'))
    await page.keyboard.type('new@keyboard.example')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/routing\/recipient-maps$/)

    await page.goto('routing/forwarding-hosts/new')
    await tabTo(page, page.getByLabel('Host'))
    await page.keyboard.type('192.0.2.77')
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-forwarding-results]')).toContainText('192.0.2.77')
  })

  test('US9 selection, a bulk action dialog and History with the keyboard; Escape returns the focus', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/recipient-maps')
    await listReady(page)
    const select = page.getByRole('button', { name: 'Select', exact: true })
    await select.focus()
    await page.keyboard.press('Enter')
    const checkbox = entry(page, 1).getByRole('checkbox')
    await checkbox.focus()
    await page.keyboard.press('Space')
    await expect(checkbox).toBeChecked()
    const remove = page
      .getByRole('region', { name: 'Bulk actions' })
      .getByRole('button', { name: /Remove|Delete/ })
    await remove.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(remove).toBeFocused()
    await page.keyboard.press('Escape')
    const history = entry(page, 1).getByRole('link', { name: /^History: / })
    await history.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/audit-log\?targetType=recipientMap&targetId=1$/)
  })
})
