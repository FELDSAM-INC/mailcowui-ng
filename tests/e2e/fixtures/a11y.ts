// Accessibility checks (constitution III, FR-079, SC-004, research R24): axe with the WCAG 2.2 AA
// tags, run in light and dark with saved and limit brand palettes (UI013 T071). The `.dark` class on <html> is toggled together with
// the emulated colour scheme, so both themes are checked whatever theme the profile chose.
import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

export interface AccessibleOptions {
  /** Selectors to leave out, for example third-party content (never the app's own UI). */
  exclude?: string[]
}

/**
 * WebKit sometimes keeps the previous theme's text colour on elements that inherit it (operator
 * HTML, the announcement, problem messages) after the theme class changes: the parent's colour is
 * updated, the children's computed colour is not, and axe reads that as a contrast failure
 * (measured with getComputedStyle; an inline custom property or a longer wait does not help).
 * Taking the app out of the render tree for one layout and putting it back makes WebKit compute
 * every style afresh. Focus and scroll positions are restored afterwards. Dialogs and menus are
 * portalled outside `#app` and stay untouched.
 */
async function refreshWebKitStyles(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = document.getElementById('app')
    if (!app) return
    const focused = document.activeElement
    const { scrollX, scrollY } = window
    app.style.display = 'none'
    void app.offsetHeight
    app.style.removeProperty('display')
    void app.offsetHeight
    window.scrollTo(scrollX, scrollY)
    if (focused instanceof HTMLElement && document.activeElement !== focused) {
      focused.focus({ preventScroll: true })
    }
  })
}

export async function expectAccessible(page: Page, options: AccessibleOptions = {}): Promise<void> {
  // Owner preference: CI runs these checks only when explicitly enabled.
  if (process.env.SKIP_A11Y === '1') return

  const before = await page.evaluate(() => ({
    dark: document.documentElement.classList.contains('dark'),
    colorScheme: document.documentElement.style.colorScheme,
    brandProperties: Object.fromEntries(
      ['light', 'dark'].flatMap((theme) =>
        ['', '-foreground', '-hover'].map((suffix) => {
          const key = `--brand-${theme}${suffix}`
          return [key, document.documentElement.style.getPropertyValue(key)]
        }),
      ),
    ),
  }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  try {
    for (const palette of ['saved', 'limit'] as const) {
      if (palette === 'limit')
        await page.evaluate(() => {
          for (const [property, colour] of Object.entries({
            '--brand-light': '#767676',
            '--brand-light-foreground': '#000000',
            '--brand-light-hover': '#868686',
            '--brand-dark': '#8f8f8f',
            '--brand-dark-foreground': '#000000',
            '--brand-dark-hover': '#9c9c9c',
          }))
            document.documentElement.style.setProperty(property, colour)
        })
      for (const theme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
        // Switch the theme as the app does (src/app/preferences/theme.ts): the class and the inline
        // `color-scheme`. The inline style also makes WebKit recompute inherited colours everywhere,
        // which a class change alone does not always do before axe reads them.
        await page.evaluate((dark) => {
          document.documentElement.classList.toggle('dark', dark)
          document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
        }, theme === 'dark')
        // Let two rendering frames pass before axe reads the styles. WebKit then still reports the
        // previous theme's inherited text colours for a moment behind a modal dialog, so it gets a
        // short settle time (measured: none left after 100 ms).
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
        )
        if (page.context().browser()?.browserType().name() === 'webkit') {
          await page.waitForTimeout(150)
          await refreshWebKitStyles(page)
        }
        let builder = new AxeBuilder({ page }).withTags(AXE_TAGS)
        for (const selector of options.exclude ?? []) builder = builder.exclude(selector)
        const results = await builder.analyze()
        const summary = results.violations.map((violation) => ({
          theme,
          palette,
          id: violation.id,
          impact: violation.impact,
          help: violation.help,
          targets: violation.nodes
            .map((node) => {
              const data = node.any[0]?.data as { fgColor?: string; bgColor?: string } | undefined
              const colours = data?.fgColor ? ` (${data.fgColor} on ${data.bgColor})` : ''
              return `${node.target.join(' ')}${colours}`
            })
            .slice(0, 5),
        }))
        expect(summary, `axe violations in the ${theme} theme (${palette} palette)`).toEqual([])
      }
    }
  } finally {
    await page.emulateMedia({ colorScheme: null, reducedMotion: null })
    await page.evaluate((state) => {
      document.documentElement.classList.toggle('dark', state.dark)
      document.documentElement.style.colorScheme = state.colorScheme
      for (const [key, value] of Object.entries(state.brandProperties)) {
        if (value) document.documentElement.style.setProperty(key, value)
        else document.documentElement.style.removeProperty(key)
      }
    }, before)
  }
}
