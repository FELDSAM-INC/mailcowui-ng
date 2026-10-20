import type { LogoSetting } from '@/api'

export type LogoMediaType = NonNullable<LogoSetting['mediaType']>

/** Classifies bytes only; the server performs decoding and authoritative SVG safety checks. */
export function detectLogoMediaType(bytes: Uint8Array): LogoMediaType | null {
  const starts = (prefix: readonly number[]) => prefix.every((byte, i) => bytes[i] === byte)
  if (starts([137, 80, 78, 71, 13, 10, 26, 10])) return 'image/png'
  if (starts([255, 216, 255])) return 'image/jpeg'
  const text = new TextDecoder().decode(bytes)
  if (text.startsWith('GIF87a') || text.startsWith('GIF89a')) return 'image/gif'
  let source = text.replace(/^\uFEFF/, '').trimStart()
  // Skip prolog syntax as text. Never parse untrusted SVG markup into the document.
  for (;;) {
    const before = source
    source = source
      .replace(/^<\?xml\b[\s\S]*?\?>\s*/i, '')
      .replace(/^<!--[\s\S]*?-->\s*/, '')
      .replace(/^<!DOCTYPE\b(?:[^>\["']|"[^"]*"|'[^']*')*(?:\[[\s\S]*?\]\s*)?>\s*/i, '')
    if (source === before) break
  }
  return /^<svg(?:\s|\/?>)/i.test(source) ? 'image/svg+xml' : null
}

export function readLogoBytes(file: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read the logo file'))
    reader.onabort = () => reject(new Error('Logo file read was cancelled'))
    reader.readAsArrayBuffer(file)
  })
}
