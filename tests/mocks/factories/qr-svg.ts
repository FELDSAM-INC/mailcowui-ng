// A BaconQrCode-style QR code as the API returns it (UI 005 T011, research R10, AG5): an SVG data
// URI with one white `rect`, nested `g` transforms and one black `path` with `fill-rule="evenodd"`.
// The modules are a deterministic pattern of the input, not a real QR code: the app only renders
// the allowlisted subset, and tests compute codes from the key shown as text.
import { createHash } from 'node:crypto'

const SIZE = 25

function modules(input: string): string {
  const bits = createHash('sha256').update(input).digest()
  const parts: string[] = []
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const index = y * SIZE + x
      const on = ((bits[index % bits.length] ?? 0) >> (index % 8)) & 1
      const finder = (x < 7 && y < 7) || (x >= SIZE - 7 && y < 7) || (x < 7 && y >= SIZE - 7)
      if (finder ? x % 6 === 0 || y % 6 === 0 || (x % 6 > 1 && x % 6 < 5) : on) {
        parts.push(`M${x} ${y}h1v1h-1z`)
      }
    }
  }
  return parts.join('')
}

/** The SVG markup of the QR code of `input`. */
export function qrSvg(input: string): string {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="200" height="200" viewBox="0 0 200 200">`,
    `<rect x="0" y="0" width="200" height="200" fill="#ffffff"/>`,
    `<g transform="scale(6.897)"><g transform="translate(2,2)">`,
    `<path fill-rule="evenodd" d="${modules(input)}" fill="#000000"/>`,
    `</g></g></svg>`,
  ].join('')
}

/** `data:image/svg+xml;base64,…` of the QR code of `input`. */
export function qrDataUri(input: string, svg = qrSvg(input)): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
}
