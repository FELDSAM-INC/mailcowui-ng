// The API's QR code under the strict CSP (UI 005 research R10, data-model §2, AG5): the
// `data:image/svg+xml;base64,…` that the production CSP cannot load as an image is decoded, parsed
// and walked; only `svg` (`viewBox`, `width`, `height`), `g` (`transform` limited to `translate`
// and `scale` with numbers), `rect` (`x`, `y`, `width`, `height`, `fill`) and `path` (`d` limited
// to path commands and numbers, `fill`, `fill-rule`) pass, with `fill` limited to hex colours.
// Anything else makes the whole result null, so nothing executable or external can be rendered.
export type QrTag = 'svg' | 'g' | 'rect' | 'path'

export interface QrNode {
  tag: QrTag
  attrs: Record<string, string>
  children: QrNode[]
}

const DATA_URI = /^data:image\/svg\+xml;base64,([A-Za-z0-9+/]+=*)$/
const NUMBER = '-?\\d+(?:\\.\\d+)?'
const TRANSFORM = new RegExp(
  `^(?:\\s*(?:translate|scale)\\(\\s*${NUMBER}(?:\\s*[,\\s]\\s*${NUMBER})?\\s*\\)\\s*)+$`,
)
const PATH = /^[MmLlHhVvZz0-9.,\s-]+$/
const COLOUR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const NUMERIC = new RegExp(`^${NUMBER}$`)
const VIEW_BOX = new RegExp(`^${NUMBER}(?:[\\s,]+${NUMBER}){3}$`)

/** Attributes allowed per element, each with its check; namespace declarations are ignored. */
const ALLOWED: Record<QrTag, Record<string, (value: string) => boolean>> = {
  svg: {
    viewBox: (value) => VIEW_BOX.test(value.trim()),
    width: (value) => NUMERIC.test(value),
    height: (value) => NUMERIC.test(value),
  },
  g: { transform: (value) => TRANSFORM.test(value) },
  rect: {
    x: (value) => NUMERIC.test(value),
    y: (value) => NUMERIC.test(value),
    width: (value) => NUMERIC.test(value),
    height: (value) => NUMERIC.test(value),
    fill: (value) => COLOUR.test(value),
  },
  path: {
    d: (value) => PATH.test(value),
    fill: (value) => COLOUR.test(value),
    'fill-rule': (value) => value === 'evenodd' || value === 'nonzero',
  },
}

const IGNORED = new Set(['xmlns', 'version'])

function walk(element: Element): QrNode | null {
  const tag = element.localName as QrTag
  const allowed = ALLOWED[tag] as Record<string, (value: string) => boolean> | undefined
  if (!allowed) return null
  const attrs: Record<string, string> = {}
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name
    if (IGNORED.has(name) || name.startsWith('xmlns:')) continue
    const check = allowed[name]
    if (!check || !check(attribute.value)) return null
    attrs[name] = attribute.value
  }
  const children: QrNode[] = []
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node.textContent ?? '').trim() !== '') return null
      continue
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null
    const child = walk(node as Element)
    if (!child) return null
    children.push(child)
  }
  return { tag, attrs, children }
}

/** The allowlisted tree of the API's QR code, or null when it cannot be shown safely. */
export function parseQrDataUri(uri: string): QrNode | null {
  const match = DATA_URI.exec(uri)
  if (!match) return null
  let text: string
  try {
    const binary = atob(match[1]!)
    text = new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
  } catch {
    return null
  }
  const document = new DOMParser().parseFromString(text, 'image/svg+xml')
  if (document.getElementsByTagName('parsererror').length > 0) return null
  const root = document.documentElement
  if (root.localName !== 'svg') return null
  return walk(root)
}
