// UI013 R13: the same sRGB/WCAG arithmetic used by the pinned API. Passing decisions use
// the full ratio; formatting must never make a failing result look like a passing one.
export type Foreground = '#000000' | '#ffffff'
export type Hsl = [hue: number, saturation: number, lightness: number]
export function normalizeHex(value: string): string | null {
  return /^#?[0-9a-f]{6}$/i.test(value) ? `#${value.replace(/^#/, '').toLowerCase()}` : null
}
function channels(value: string): number[] | null {
  const hex = normalizeHex(value)
  return hex ? [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)) : null
}
function rgbHex(values: number[]) {
  return `#${values.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`
}
export function luminance(value: string): number | null {
  const rgb = channels(value)?.map((channel) => {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return rgb ? 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]! : null
}
export function contrastRatio(colour: string, surface: string): number | null {
  const a = luminance(colour),
    b = luminance(surface)
  return a === null || b === null ? null : (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
export function foreground(colour: string): Foreground | null {
  const white = contrastRatio(colour, '#ffffff'),
    black = contrastRatio(colour, '#000000')
  return white === null || black === null ? null : white > black ? '#ffffff' : '#000000'
}
export function hoverColor(colour: string, text: Foreground): string | null {
  return channels(colour)
    ? rgbHex(channels(colour)!.map((c) => c + ((text === '#ffffff' ? 0 : 255) - c) * 0.12))
    : null
}
export function ratioLabel(ratio: number, minimum: number, locale: string): string {
  let display = Math.round(ratio * 10) / 10
  if (ratio < minimum && display >= minimum) display = Math.floor(ratio * 10) / 10
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(display)
}
export function hexToHsl(value: string): Hsl | null {
  const rgb = channels(value)?.map((c) => c / 255)
  if (!rgb) return null
  const [r, g, b] = rgb as [number, number, number]
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min,
    l = (max + min) / 2
  if (!delta) return [0, 0, l]
  const h =
    max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
  return [(h * 60 + 360) % 360, delta / (1 - Math.abs(2 * l - 1)), l]
}
export function hslToHex([h, s, l]: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = l - c / 2
  const rgb =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  return rgbHex(rgb.map((channel) => (channel + m) * 255))
}
export function adjust(colour: string, surface: string, minimum: number): string | null {
  const original = normalizeHex(colour),
    hsl = hexToHsl(colour),
    ratio = contrastRatio(colour, surface)
  if (!original || !hsl || ratio === null || !Number.isFinite(minimum) || minimum < 1) return null
  if (ratio >= minimum) return original
  const [h, s, l] = hsl
  const candidates: { value: string; distance: number }[] = []
  for (const end of [0, 1]) {
    if (contrastRatio(hslToHex([h, s, end]), surface)! < minimum) continue
    let fail = l,
      pass = end
    // Test the actual rounded RGB value at each step, so the offer itself always passes.
    for (let iteration = 0; iteration < 32; iteration++) {
      const middle = (fail + pass) / 2
      if (contrastRatio(hslToHex([h, s, middle]), surface)! >= minimum) pass = middle
      else fail = middle
    }
    candidates.push({ value: hslToHex([h, s, pass]), distance: Math.abs(pass - l) })
  }
  return candidates.sort((a, b) => a.distance - b.distance)[0]?.value ?? null
}
