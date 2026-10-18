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
  const wasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.evaluate((dark) => {
      document.documentElement.classList.toggle('dark', dark)
    }, theme === 'dark')
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
  await page.evaluate((dark) => {
    document.documentElement.classList.toggle('dark', dark)
  }, wasDark)
}
