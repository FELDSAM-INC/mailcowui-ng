import { describe, expect, it } from 'vitest'
import {
  adjust,
  contrastRatio,
  foreground,
  hexToHsl,
  hoverColor,
  hslToHex,
  luminance,
  normalizeHex,
  ratioLabel,
} from '@/shared/color/contrast'

describe('WCAG colour arithmetic (API R5 / UI013 R13)', () => {
  it('linearises both sides of the sRGB threshold with the specified luminance weights', () => {
    expect(luminance('#0a0000')).toBeCloseTo(0.2126 * (10 / 255 / 12.92), 12)
    expect(luminance('#0b0000')).toBeCloseTo(0.2126 * ((11 / 255 + 0.055) / 1.055) ** 2.4, 12)
    expect(luminance('#00ff00')).toBe(0.7152)
    expect(luminance('#0000ff')).toBe(0.0722)
    expect(contrastRatio('#000000', '#ffffff')).toBe(21)
  })
  it.each([
    ['#1D4ED8', '#ffffff', 6.7],
    ['#1D4ED8', '#1D2939', 2.19],
    ['#FFD700', '#ffffff', 1.4],
    ['#60A5FA', '#1D2939', 5.78],
  ])('matches the API floor for %s on %s', (colour, surface, expected) => {
    expect(Math.floor(contrastRatio(colour, surface)! * 100) / 100).toBe(expected)
  })
  it('chooses the strongest black/white foreground and increases its contrast on hover', () => {
    expect(foreground('#1d4ed8')).toBe('#ffffff')
    expect(foreground('#60a5fa')).toBe('#000000')
    for (const colour of ['#1d4ed8', '#60a5fa', '#767676', '#8f8f8f']) {
      const text = foreground(colour)!
      expect(contrastRatio(hoverColor(colour, text)!, text)).toBeGreaterThan(
        contrastRatio(colour, text)!,
      )
    }
  })
  it('never rounds a failing ratio up to the advertised minimum and formats the locale', () => {
    expect(ratioLabel(4.46, 4.5, 'en-gb')).toBe('4.4')
    expect(ratioLabel(4.5, 4.5, 'en-gb')).toBe('4.5')
    expect(ratioLabel(6.7, 4.5, 'cs-cz')).toBe('6,7')
  })
  it('accepts only six hex digits, optionally prefixed; empty clears', () => {
    expect(normalizeHex('1D4ED8')).toBe('#1d4ed8')
    expect(normalizeHex('#1D4ED8')).toBe('#1d4ed8')
    expect(normalizeHex('')).toBeNull()
    for (const invalid of ['#abc', 'white', '1234567', '#12345z', '#123456;']) {
      expect(normalizeHex(invalid)).toBeNull()
      expect(adjust(invalid, '#ffffff', 4.5)).toBeNull()
    }
  })
  it('preserves HSL hue/saturation when finding the nearest passing lightness', () => {
    const input = '#ffd700',
      result = adjust(input, '#ffffff', 4.5)!
    const [h, s, l] = hexToHsl(input)!
    expect(contrastRatio(result, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    const [adjustedHue, adjustedSaturation, adjustedLightness] = hexToHsl(result)!
    expect(adjustedHue).toBeCloseTo(h, 0)
    expect(adjustedSaturation).toBe(s)
    for (let step = 1; step <= 255; step++) {
      const nearer = adjustedLightness + step / 255
      if (nearer >= l) break
      expect(contrastRatio(hslToHex([h, s, nearer]), '#ffffff')).toBeLessThan(4.5)
    }
    expect(hexToHsl(adjust('#1d4ed8', '#1d2939', 4.5)!)![2]).toBeGreaterThan(
      hexToHsl('#1d4ed8')![2],
    )
    expect(adjust('#1d4ed8', '#ffffff', 4.5)).toBe('#1d4ed8')
    expect(adjust('#ffd700', '#ffffff', 22)).toBeNull()
  })
  it('round-trips representative RGB and achromatic colours without channel drift', () => {
    for (const colour of [
      '#000000',
      '#ffffff',
      '#808080',
      '#ff0000',
      '#00ff00',
      '#0000ff',
      '#1d4ed8',
      '#ffd700',
    ])
      expect(hslToHex(hexToHsl(colour)!)).toBe(colour)
  })
})
