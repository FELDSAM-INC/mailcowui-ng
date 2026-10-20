import { describe, expect, it } from 'vitest'
import { populateEmailPreview } from '@/features/system-settings/lib/email-html'
import { replaceResetSamples } from '@/features/system-settings/lib/email-samples'

describe('isolated email preview content', () => {
  it('removes more than twenty inline event attributes before parsing', () => {
    const target = document.implementation.createHTMLDocument('Preview')
    populateEmailPreview(
      target,
      `<p ${Array.from({ length: 40 }, (_, i) => `on${'x'.repeat(i + 1)}="bad()"`).join(' ')} style="font-weight:bold">Safe</p>`,
      () => 'Image omitted',
    )
    expect(target.body.querySelector('p')?.style.fontWeight).toBe('bold')
    expect(target.body.querySelector('p')?.attributes.length).toBe(1)
  })
  it('keeps layout but removes active content, resources and link actions', () => {
    const target = document.implementation.createHTMLDocument('Preview')
    populateEmailPreview(
      target,
      `<base href="https://evil.invalid"><meta http-equiv="refresh" content="0;https://evil.invalid"><script>window.__pwned=true</script><style>@import url(https://evil.invalid/a); p { color: red; background-image: url(https://evil.invalid/b); }</style><form action="https://evil.invalid"><input></form><p onclick="alert(1)" style="font-weight: bold; background: url(https://evil.invalid/c)">Hello <a href="javascript:alert(1)">link</a><img src="https://evil.invalid/pixel" alt="Logo"></p>`,
      (alt) => `Image omitted: ${alt}`,
    )
    expect(
      target.body.querySelectorAll(
        'script,style,iframe,form,input,base,meta,img,[href],[src],[onclick]',
      ),
    ).toHaveLength(0)
    expect(target.body.textContent).toContain('Hello link')
    expect(target.body.textContent).toContain('Image omitted: Logo')
    expect(target.body.querySelector('p')?.style.fontWeight).toBe('bold')
    expect(target.body.querySelector('p')?.style.backgroundImage).toBe('')
  })
  it('inserts sample placeholders as escaped text in HTML', () => {
    expect(
      replaceResetSamples(
        '<p>{{hostname}} {{username}}</p>',
        { hostname: '<img src=x>', username: 'alice@example.org' },
        true,
      ),
    ).toBe('<p>&lt;img src=x&gt; alice@example.org</p>')
    expect(replaceResetSamples('{{hostname}}', { hostname: '<mail>' }, false)).toBe('<mail>')
  })
})
