import { describe, expect, it } from 'vitest'
import { sanitizeHtml } from '@/shared/security/sanitize'
import { sanitizeHtmlWithReport } from '@/shared/security/sanitize-report'

describe('Operator HTML preview report (T055/T060)', () => {
  it.each([
    ['scripts', '<script>alert(1)</script>'],
    ['styles', '<style>body{display:none}</style><p>x</p>'],
    ['styles', '<p style="color:red">x</p>'],
    ['images', '<img src="https://evil.example/track">'],
    ['forms', '<form><input name="x"></form>'],
    ['frames', '<iframe src="https://evil.example/"></iframe>'],
    ['eventHandlers', '<p onclick="alert(1)">x</p>'],
    ['links', '<a href="javascript:alert(1)">x</a>'],
    ['links', '<a href="/relative">x</a>'],
    ['formatting', '<div class="custom"><span>x</span></div>'],
  ])('reports removed %s while preserving shell output', (kind, source) => {
    const result = sanitizeHtmlWithReport(source)
    expect(result.html).toBe(sanitizeHtml(source))
    expect(result.removed).toContain(kind)
  })
  it('reports no removal for allowed formatting and accepted links', () => {
    const source = '<p>Help <a href="https://help.example.org/">here</a>.</p>'
    expect(sanitizeHtmlWithReport(source)).toEqual({ html: sanitizeHtml(source), removed: [] })
  })
  it('does not carry removals between previews', () => {
    sanitizeHtmlWithReport('<p onerror="alert(1)">x</p>')
    expect(sanitizeHtmlWithReport('Plain text').removed).toEqual([])
  })
})
