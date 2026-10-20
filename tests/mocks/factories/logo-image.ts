import type { LogoSetting } from '@/api'
/** Mock-side inspection mirrors the API's fixture formats; it is never shipped to browsers. */
export function inspectLogo(bytes: Uint8Array) {
  const data = Buffer.from(bytes)
  const text = data.toString('utf8')
  let mediaType: LogoSetting['mediaType'] = null
  let width: number | null = null,
    height: number | null = null
  if (
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    data.length >= 24
  ) {
    mediaType = 'image/png'
    width = data.readUInt32BE(16)
    height = data.readUInt32BE(20)
  } else if (/^GIF8[79]a/.test(text) && data.length >= 10) {
    mediaType = 'image/gif'
    width = data.readUInt16LE(6)
    height = data.readUInt16LE(8)
  } else if (data[0] === 255 && data[1] === 216 && data[2] === 255) {
    mediaType = 'image/jpeg'
    for (let offset = 2; offset + 8 < data.length;) {
      if (data[offset] !== 255) break
      const marker = data[offset + 1]!
      const length = data.readUInt16BE(offset + 2)
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        height = data.readUInt16BE(offset + 5)
        width = data.readUInt16BE(offset + 7)
        break
      }
      if (length < 2) break
      offset += length + 2
    }
  } else if (/<svg(?:\s|\/?>)/i.test(text)) {
    mediaType = 'image/svg+xml'
    const root = text.match(/<svg\b[^>]*>/i)?.[0] ?? ''
    const dimension = (key: string) => {
      const value = root.match(new RegExp(`\\b${key}=["'](\\d+(?:\\.\\d+)?)(?:px)?["']`))?.[1]
      return value ? Math.floor(Number(value)) : null
    }
    width = dimension('width')
    height = dimension('height')
  }
  return { mediaType, width, height }
}
export function unsafeSvg(bytes: Uint8Array) {
  const source = Buffer.from(bytes).toString('utf8')
  const patterns: [RegExp, string][] = [
    [/<!DOCTYPE\b/i, 'doctype'],
    [/<!ENTITY\b/i, 'entity'],
    [/<(?:[\w-]+:)?script\b/i, 'scriptElement'],
    [/\son[\w-]+\s*=/i, 'eventHandlerAttribute'],
    [/(?:javascript:|vbscript:|data:text\/html)/i, 'scriptUrl'],
    [/<foreignObject\b/i, 'foreignContent'],
    [/(?:href|src)\s*=\s*["'](?:https?:|\/\/)/i, 'externalReference'],
    [/\@import\b/i, 'styleImport'],
  ]
  for (const [pattern, construct] of patterns) {
    const matched = pattern.exec(source)
    if (matched) return { construct, line: source.slice(0, matched.index).split('\n').length }
  }
  return null
}
