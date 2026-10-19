// Operator HTML (help text, footer) is sanitised before display (FR-002, SC-013, research R17).
import { describe, expect, it } from 'vitest'

import { sanitizeHtml, sanitizeLegacyHtml } from '@/shared/security/sanitize'

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

describe('defangForParsing (CSP reports while parsing)', () => {
  it('drops style elements and renames handler and style attributes before DOMPurify parses', async () => {
    const { defangForParsing } = await import('@/shared/security/sanitize')
    expect(
      defangForParsing(
        '<p onclick="a()" style="color:red" onmouseover=b()>x</p><style>body{}</style><svg/onload=c()>',
      ),
    ).toBe(
      '<p data-removed-onclick="a()" data-removed-style="color:red" data-removed-onmouseover=b()>x</p><svg/data-removed-onload=c()>',
    )
    expect(defangForParsing('Turn on= the light <b>now</b>')).toBe('Turn on= the light <b>now</b>')
  })
})

describe('sanitizeLegacyHtml: markup in mailcow language values (constitution IV 1.3.0)', () => {
  it('keeps the formatting legacy values use', () => {
    const input =
      '<p><b>b</b><strong>s</strong><i>i</i><em>e</em><small>m</small><code>c</code>' +
      '<span>sp</span><br></p><div>d</div><ul><li>one</li></ul><ol><li>two</li></ol>'
    const root = parse(sanitizeLegacyHtml(input))
    for (const tag of [
      'p',
      'b',
      'strong',
      'i',
      'em',
      'small',
      'code',
      'span',
      'br',
      'div',
      'ul',
      'ol',
      'li',
    ]) {
      expect(root.querySelector(tag), tag).not.toBeNull()
    }
  })

  it('decodes character references without changing the text', () => {
    expect(parse(sanitizeLegacyHtml('&#10003;')).textContent).toBe('✓')
    expect(parse(sanitizeLegacyHtml('&lt;domain&gt; &#8226; a')).textContent).toBe('<domain> • a')
  })

  it.each([
    ['/api', '/api'],
    ['https://docs.mailcow.email/', 'https://docs.mailcow.email/'],
    ['mailto:postmaster@example.org', 'mailto:postmaster@example.org'],
    ['#', '#'],
    ['../edit', '../edit'],
  ])('keeps the link %s with rel="noopener noreferrer"', (href, expected) => {
    const link = parse(sanitizeLegacyHtml(`See <a href="${href}">here</a>`)).querySelector('a')
    expect(link?.getAttribute('href')).toBe(expected)
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('keeps target="_blank" only, always with rel', () => {
    const blank = parse(
      sanitizeLegacyHtml('<a href="https://x.example" target="_blank">x</a>'),
    ).querySelector('a')
    expect(blank?.getAttribute('target')).toBe('_blank')
    expect(blank?.getAttribute('rel')).toBe('noopener noreferrer')
    const named = parse(
      sanitizeLegacyHtml('<a href="https://x.example" target="other">x</a>'),
    ).querySelector('a')
    expect(named?.hasAttribute('target')).toBe(false)
  })

  it('removes classes, data attributes and the rest of what legacy markup carries', () => {
    const root = parse(
      sanitizeLegacyHtml(
        '<span class="badge">x</span><a href="#" data-bs-toggle="popover" alt="y" lang="en">z</a>',
      ),
    )
    for (const element of root.querySelectorAll('*')) {
      for (const attribute of element.attributes) {
        expect(attribute.name).toMatch(/^(href|rel|target)$/)
      }
    }
  })

  it.each([
    ['javascript: href', '<a href="javascript:alert(1)">x</a>'],
    ['protocol-relative link', '<a href="//evil.example">x</a>'],
    ['data: href', '<a href="data:text/html,x">x</a>'],
    ['script', '<b>x</b><script>alert(1)</script>'],
    ['image', '<img src=x onerror=alert(1)>'],
    ['style attribute', '<b style="color:red">x</b>'],
    ['heading', '<h1>x</h1>'],
  ])('neutralises %s', (_label, input) => {
    const root = parse(sanitizeLegacyHtml(input))
    expect(root.querySelector('script, img, h1, [style], [onerror]')).toBeNull()
    for (const link of root.querySelectorAll('a[href]')) {
      expect(link.getAttribute('href')).not.toMatch(/^(?:javascript:|data:|\/\/)/i)
    }
  })

  it('does not change the operator profile', () => {
    const link = parse(sanitizeHtml('<a href="/api" target="_blank">x</a>')).querySelector('a')
    expect(link?.hasAttribute('href')).toBe(false)
  })
})

describe('sanitizeReleaseNotes (UI 011, FR-028, T128)', () => {
  it('keeps the Markdown formatting tags with href and align', async () => {
    const { sanitizeReleaseNotes } = await import('@/shared/security/sanitize')
    const root = parse(
      sanitizeReleaseNotes(
        '<h2>T</h2><p><strong>b</strong> <em>e</em> <del>d</del></p><ul><li>x</li></ul><ol><li>y</li></ol><blockquote>q</blockquote><pre><code>c</code></pre><table><thead><tr><th align="left">h</th></tr></thead><tbody><tr><td align="right">v</td></tr></tbody></table><hr>',
        '(opens in a new tab)',
      ),
    )
    for (const tag of [
      'h2',
      'strong',
      'em',
      'del',
      'ul',
      'ol',
      'blockquote',
      'pre',
      'code',
      'table',
      'thead',
      'tbody',
      'th',
      'td',
      'hr',
    ]) {
      expect(root.querySelector(tag), tag).not.toBeNull()
    }
    expect(root.querySelector('th')?.getAttribute('align')).toBe('left')
  })

  it('removes images, styles, classes, handlers, frames, forms, svg and unsafe links', async () => {
    const { sanitizeReleaseNotes } = await import('@/shared/security/sanitize')
    const output = sanitizeReleaseNotes(
      '<img src="https://x.example/a.png"><p class="c" style="color:red" onclick="x()">p</p><iframe src="https://x.example"></iframe><form><input></form><svg onload="x()"></svg><a href="javascript:alert(1)">j</a><a href="/rel">r</a>',
      '(opens in a new tab)',
    )
    const root = parse(output)
    expect(
      root.querySelector(
        'img, iframe, form, input, svg, [class]:not(.sr-only), [style], [onclick]',
      ),
    ).toBeNull()
    for (const link of root.querySelectorAll('a')) expect(link.hasAttribute('href')).toBe(false)
    expect(output).not.toMatch(/javascript:/i)
  })

  it('opens links in a new window without access to the app and says so', async () => {
    const { sanitizeReleaseNotes } = await import('@/shared/security/sanitize')
    const root = parse(
      sanitizeReleaseNotes('<a href="https://example.org/r">release</a>', '(opens in a new tab)'),
    )
    const link = root.querySelector('a')!
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer nofollow')
    expect(link.querySelector('.sr-only')?.textContent).toBe(' (opens in a new tab)')
  })

  it('neutralises the injection vectors of the operator profile', async () => {
    const { sanitizeReleaseNotes } = await import('@/shared/security/sanitize')
    for (const input of [
      '<p>Hi</p><script>alert(1)</script>',
      '<img src=x onerror="alert(1)">',
      '<a href="jav&#x09;ascript:alert(1)">x</a>',
      '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
      '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>',
    ]) {
      const output = sanitizeReleaseNotes(input, '(opens in a new tab)')
      expect(output).not.toMatch(/<script|onerror|javascript:|data:/i)
      expect(parse(output).querySelector('img, script, style')).toBeNull()
    }
  })
})
