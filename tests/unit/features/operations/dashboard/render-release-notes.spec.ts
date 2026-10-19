// UI 011 (FR-028, research R9, T129): release notes keep their Markdown formatting; raw HTML is
// shown as text, images become links labelled with their description, and javascript: links are
// their text.
import { describe, expect, it } from 'vitest'

import { renderReleaseNotes } from '@/features/operations/dashboard/release-notes/render-release-notes'

const texts = { image: (description: string) => `Image: ${description}`, imageUntitled: 'Image' }

function parse(html: string) {
  const root = document.createElement('div')
  // Parsed in a detached element only to inspect it; never rendered.
  root.innerHTML = html
  return root
}

describe('renderReleaseNotes', () => {
  it('keeps headings, emphasis, lists, code, quotes, tables and links', async () => {
    const root = parse(
      await renderReleaseNotes(
        '## Title\n\n**bold** *em*\n\n- one\n\n```\ncode\n```\n\n> quote\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n[docs](https://docs.mailcow.email/)',
        texts,
      ),
    )
    expect(root.querySelector('h2')?.textContent).toBe('Title')
    expect(root.querySelector('strong')?.textContent).toBe('bold')
    expect(root.querySelector('em')?.textContent).toBe('em')
    expect(root.querySelector('ul li')?.textContent).toBe('one')
    expect(root.querySelector('pre code')?.textContent).toBe('code\n')
    expect(root.querySelector('blockquote')?.textContent?.trim()).toBe('quote')
    expect(root.querySelectorAll('table th')).toHaveLength(2)
    expect(root.querySelector('a')?.getAttribute('href')).toBe('https://docs.mailcow.email/')
  })

  it('shows block and inline HTML as text', async () => {
    const html = await renderReleaseNotes(
      '<script>alert(1)</script>\n\nText with <img src=x onerror=alert(1)> inline.',
      texts,
    )
    const root = parse(html)
    expect(root.querySelector('script, img')).toBeNull()
    expect(root.textContent).toContain('<script>alert(1)</script>')
    expect(root.textContent).toContain('<img src=x onerror=alert(1)>')
  })

  it('turns images into links labelled with their description, never loading them', async () => {
    const root = parse(
      await renderReleaseNotes(
        '![Release diagram](https://images.example.net/d.png) ![](https://images.example.net/e.png)',
        texts,
      ),
    )
    expect(root.querySelector('img')).toBeNull()
    const links = [...root.querySelectorAll('a')].map((a) => [
      a.textContent,
      a.getAttribute('href'),
    ])
    expect(links).toEqual([
      ['Image: Release diagram', 'https://images.example.net/d.png'],
      ['Image', 'https://images.example.net/e.png'],
    ])
  })

  it('renders javascript: and relative links as their text', async () => {
    const root = parse(
      await renderReleaseNotes('[click](javascript:alert(1)) [rel](/admin)', texts),
    )
    expect(root.querySelector('a')).toBeNull()
    expect(root.textContent).toContain('click')
  })
})
