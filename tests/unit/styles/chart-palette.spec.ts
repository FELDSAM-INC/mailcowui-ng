// UI 011 (FR-083, WCAG 1.4.11, T027): the two chart series colours have at least 3:1 contrast
// against the card surface in the light theme (white) and the dark theme (gray-900).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/styles/main.css'), 'utf8')

function token(block: string, name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(block)
  if (!match) throw new Error(`--${name} not found`)
  return match[1]!
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

const theme = css.slice(css.indexOf('@theme {'))
const dark = css.slice(css.indexOf(':root.dark {'))
const darkBlock = dark.slice(0, dark.indexOf('}'))

describe('chart palette', () => {
  it.each(['color-chart-1', 'color-chart-2'])('%s reaches 3:1 on the light card', (name) => {
    expect(contrast(token(theme, name), token(theme, 'color-white'))).toBeGreaterThanOrEqual(3)
  })

  it.each(['color-chart-1', 'color-chart-2'])('%s reaches 3:1 on the dark card', (name) => {
    expect(contrast(token(darkBlock, name), token(theme, 'color-gray-900'))).toBeGreaterThanOrEqual(
      3,
    )
  })

  it('differs between the two series', () => {
    expect(token(theme, 'color-chart-1')).not.toBe(token(theme, 'color-chart-2'))
  })
})
