// Operator HTML (help text, footer) is sanitised before display (FR-002, SC-013, research R17).
import { describe, expect, it } from 'vitest'

import { sanitizeHtml } from '@/shared/security/sanitize'

function parse(html: string): HTMLElement {
  const root = document.createElement('div')
  // Parsing the sanitiser's output in a detached element to inspect it; never rendered.
  root.innerHTML = html
  return root
}

/** No executable or embedding construct survives anywhere in the output. */
function expectNeutralised(output: string) {
  const root = parse(output)
  expect(
    root.querySelector('script, style, iframe, form, svg, math, img, object, embed'),
  ).toBeNull()
  expect(root.querySelector('input, button, textarea, select, link, meta, base')).toBeNull()
  for (const element of root.querySelectorAll('*')) {
    for (const attribute of element.attributes) {
      expect(attribute.name).toMatch(/^(href|rel)$/)
      expect(attribute.name.startsWith('on')).toBe(false)
    }
    const href = element.getAttribute('href')
    if (href !== null) expect(href).toMatch(/^(?:https?:|mailto:)/i)
  }
  expect(output).not.toMatch(/javascript:/i)
  expect(output).not.toMatch(/<script/i)
}

describe('sanitizeHtml: injection vectors (SC-013)', () => {
  const vectors: [string, string][] = [
    ['script element', '<p>Hi</p><script>alert(1)</script>'],
    ['script with src', '<script src="https://evil.example/x.js"></script>'],
    ['onerror handler', '<img src=x onerror="alert(1)">'],
    ['onclick on an allowed tag', '<p onclick="alert(1)">Click</p>'],
    ['javascript: href', '<a href="javascript:alert(1)">x</a>'],
    ['javascript: href with entities', '<a href="jav&#x09;ascript:alert(1)">x</a>'],
    ['javascript: href with leading space', '<a href=" javascript:alert(1)">x</a>'],
    ['data: href', '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>'],
    ['vbscript: href', '<a href="vbscript:msgbox(1)">x</a>'],
    ['iframe', '<iframe src="https://evil.example"></iframe>'],
    ['srcdoc iframe', '<iframe srcdoc="<script>alert(1)</script>"></iframe>'],
    [
      'form',
      '<form action="https://evil.example"><input name="password"><button>Go</button></form>',
    ],
    ['svg onload', '<svg onload="alert(1)"><circle r="1"/></svg>'],
    ['svg with script', '<svg><script>alert(1)</script></svg>'],
    ['style element', '<style>body{display:none}</style><p>x</p>'],
    ['style attribute', '<p style="background:url(javascript:alert(1))">x</p>'],
    ['image from another host', '<img src="//evil.example/track.gif">'],
    ['math mutation XSS', '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>'],
    [
      'noscript mutation',
      '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>',
    ],
    ['object and embed', '<object data="x.swf"></object><embed src="x.swf">'],
    ['meta refresh', '<meta http-equiv="refresh" content="0;url=https://evil.example">'],
    ['base href', '<base href="https://evil.example/">'],
    ['class and id attributes', '<p class="x" id="y">x</p>'],
    ['relative link', '<a href="/admin">x</a>'],
    ['protocol-relative link', '<a href="//evil.example">x</a>'],
  ]

  it.each(vectors)('neutralises %s', (_label, input) => {
    expectNeutralised(sanitizeHtml(input))
  })

  it('keeps the text of removed formatting containers', () => {
    expect(parse(sanitizeHtml('<div><span>Need help?</span></div>')).textContent).toBe('Need help?')
  })
})

describe('sanitizeHtml: allowed formatting', () => {
  it('keeps the allowed tags', () => {
    const input =
      '<h1>A</h1><h2>B</h2><h3>C</h3><h4>D</h4><h5>E</h5><h6>F</h6>' +
      '<p>Text<br><strong>s</strong><b>b</b><em>e</em><i>i</i><u>u</u><small>m</small></p>' +
      '<ul><li>one</li></ul><ol><li>two</li></ol><blockquote>q</blockquote>'
    const root = parse(sanitizeHtml(input))
    for (const tag of [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      'small',
      'ul',
      'ol',
      'li',
      'blockquote',
    ]) {
      expect(root.querySelector(tag), tag).not.toBeNull()
    }
  })

  it.each([
    'https://help.example.org/',
    'http://help.example.org/page',
    'mailto:support@example.org',
    'HTTPS://help.example.org/',
  ])('keeps the link %s with rel="noopener noreferrer nofollow"', (href) => {
    const link = parse(sanitizeHtml(`<p>Call <a href="${href}">us</a></p>`)).querySelector('a')
    expect(link?.getAttribute('href')).toBe(href)
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer nofollow')
    expect(link?.textContent).toBe('us')
  })

  it('removes target and other link attributes', () => {
    const link = parse(
      sanitizeHtml('<a href="https://x.example" target="_blank" title="t" download>x</a>'),
    ).querySelector('a')
    expect([...(link?.attributes ?? [])].map((a) => a.name).sort()).toEqual(['href', 'rel'])
  })

  it('keeps a link without href as text only', () => {
    const root = parse(sanitizeHtml('<a>plain</a>'))
    expect(root.textContent).toBe('plain')
    expect(root.querySelector('a[rel]')).toBeNull()
  })

  it('returns plain text unchanged', () => {
    expect(sanitizeHtml('Maintenance on Sunday')).toBe('Maintenance on Sunday')
  })

  it('returns an empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('')
  })
})
