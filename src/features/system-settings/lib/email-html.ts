// R21: the only consumer is the password-reset preview. Keep this profile local until another
// settings email actually needs it. The app's CSP is unchanged; the frame has no script permission.
import DOMPurify from 'dompurify'

const purify = DOMPurify(window)
const tags = [
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'colgroup',
  'col',
  'div',
  'span',
  'font',
  'center',
  'p',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'b',
  'strong',
  'i',
  'em',
  'u',
  'small',
  'blockquote',
  'pre',
  'code',
  'a',
  'img',
]
const safeProperties =
  /^(?:color|background-color|font(?:-family|-size|-style|-weight)?|line-height|letter-spacing|word-spacing|text-align|text-decoration(?:-color|-line|-style)?|text-transform|vertical-align|white-space|display|width|height|min-width|max-width|min-height|max-height|margin(?:-top|-right|-bottom|-left)?|padding(?:-top|-right|-bottom|-left)?|border(?:-top|-right|-bottom|-left)?(?:-width|-style|-color|-radius)?|border-collapse|border-spacing|table-layout|list-style-type)$/

function applyStyle(element: HTMLElement, css: string) {
  const parsed = document.createElement('span').style
  parsed.cssText = css
  for (let i = 0; i < parsed.length; i += 1) {
    const property = parsed.item(i)
    const value = parsed.getPropertyValue(property)
    // A property allowlist also prevents custom properties from smuggling resource URLs into
    // another declaration. Decode escapes before checking functions; CSSOM may retain them.
    const plain = value
      .replace(/\\([\da-f]{1,6})\s?/gi, (_, hex: string) =>
        String.fromCodePoint(Math.min(parseInt(hex, 16) || 0xfffd, 0x10ffff)),
      )
      .replace(/\\(.)/g, '$1')
    if (safeProperties.test(property) && !/(?:url|image-set|src|expression|var)\s*\(/i.test(plain))
      element.style.setProperty(property, value, parsed.getPropertyPriority(property))
  }
}

export function populateEmailPreview(
  target: Document,
  html: string,
  imageLabel: (alt: string) => string,
): void {
  const blocks: string[] = []
  let inert = html.replace(/<style\b[^>]*>([\s\S]*?)(?:<\/style\s*>|$)/gi, (_, css: string) => {
    blocks.push(css)
    return ''
  })
  // Avoid CSP reports and resource requests while the sanitizer parses. DOMPurify, below, is the
  // security boundary; renamed attributes are accepted only for inert link labels and CSS text.
  inert = inert.replace(/<[a-z](?:[^"'<>]|"[^"]*"|'[^']*')*>/gi, (tag) =>
    tag.replace(
      /([^\s="'<>/]+)(\s*=\s*)(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/g,
      (attribute, name: string) =>
        /^(?:on[a-z]+|style|href|src|srcset|background|poster|lowsrc|dynsrc)$/i.test(name)
          ? `data-preview-${name.toLowerCase()}${attribute.slice(name.length)}`
          : attribute,
    ),
  )
  const fragment = purify.sanitize(inert, {
    ALLOWED_TAGS: tags,
    ALLOWED_ATTR: [
      'alt',
      'title',
      'width',
      'height',
      'align',
      'valign',
      'colspan',
      'rowspan',
      'cellpadding',
      'cellspacing',
      'border',
      'bgcolor',
      'color',
      'size',
      'face',
      'class',
      'id',
      'data-preview-style',
      'data-preview-href',
    ],
    ADD_URI_SAFE_ATTR: ['data-preview-style', 'data-preview-href'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  })
  for (const image of fragment.querySelectorAll('img')) {
    const label = document.createElement('span')
    label.textContent = imageLabel(image.getAttribute('alt') ?? '')
    image.replaceWith(label)
  }
  for (const link of fragment.querySelectorAll('a')) {
    if (link.hasAttribute('data-preview-href'))
      link.setAttribute('title', link.getAttribute('data-preview-href')!)
    link.removeAttribute('data-preview-href')
  }
  target.body.replaceChildren(target.importNode(fragment, true))
  // Detached constructed sheets never fetch imports. At-rules are ignored, including @import,
  // @font-face and nested rules. Only safe declarations of ordinary style rules are applied.
  for (const css of blocks) {
    try {
      const sheet = new CSSStyleSheet()
      sheet.replaceSync(css.replace(/@import\s[^;]*;?/gi, ''))
      for (const rule of sheet.cssRules) {
        if (!(rule instanceof CSSStyleRule)) continue
        try {
          for (const node of target.body.querySelectorAll<HTMLElement>(rule.selectorText))
            applyStyle(node, rule.style.cssText)
        } catch {
          /* Invalid selectors are inert. */
        }
      }
    } catch {
      /* A browser without constructed sheets still shows safe inline formatting. */
    }
  }
  for (const node of target.body.querySelectorAll<HTMLElement>('[data-preview-style]')) {
    const css = node.getAttribute('data-preview-style')!
    node.removeAttribute('data-preview-style')
    applyStyle(node, css)
  }
  target.body.style.margin = '16px'
  target.body.style.overflowWrap = 'anywhere'
}
