// Accessibility checks (constitution III, FR-079, SC-004, research R24): axe with the WCAG 2.2 AA
// tags, run once in light and once in dark. The `.dark` class on <html> is toggled together with
// the emulated colour scheme, so both themes are checked whatever theme the profile chose.
import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

export interface AccessibleOptions {
  /** Selectors to leave out, for example third-party content (never the app's own UI). */
  exclude?: string[]
}

export async function expectAccessible(page: Page, options: AccessibleOptions = {}): Promise<void> {
  const before = await page.evaluate(() => ({
    dark: document.documentElement.classList.contains('dark'),
    colorScheme: document.documentElement.style.colorScheme,
  }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
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
    if (page.context().browser()?.browserType().name() === 'webkit') await page.waitForTimeout(150)
    let builder = new AxeBuilder({ page }).withTags(AXE_TAGS)
    for (const selector of options.exclude ?? []) builder = builder.exclude(selector)
    const results = await builder.analyze()
    const summary = results.violations.map((violation) => ({
      theme,
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target.join(' ')).slice(0, 5),
    }))
    expect(summary, `axe violations in the ${theme} theme`).toEqual([])
  }
  await page.emulateMedia({ colorScheme: null, reducedMotion: null })
  await page.evaluate((state) => {
    document.documentElement.classList.toggle('dark', state.dark)
    document.documentElement.style.colorScheme = state.colorScheme
  }, before)
}
