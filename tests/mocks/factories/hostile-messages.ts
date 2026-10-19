// UI 006 (T025, research R9, SC-002): the hostile corpus. Every vector is usable as a subject, a
// From header, a sender, a symbol option, a file name and a text part; `hostileQuarantineItems`
// turns each one into an item that carries it in all of those places, cut to the contract's maximum
// lengths. Markup, scripts and links must stay inert text, remote references must cause no request,
// and every control, bidi and invisible character must show as a visible marker.
import type { MockQuarantineItem } from '../scenarios/state'
import { mockQuarantineItem } from './quarantine-item'

export interface HostileVector {
  name: string
  value: string
}

const C0 = Array.from({ length: 32 }, (_, code) => String.fromCharCode(code))
  .filter((char) => char !== '\n' && char !== '\t')
  .join('')
const C1 = Array.from({ length: 32 }, (_, code) => String.fromCharCode(0x80 + code)).join('')

export const HOSTILE_VECTORS: readonly HostileVector[] = [
  // Markup and scripts
  { name: 'script tag', value: '<script>window.__xss=1</script>' },
  { name: 'script src', value: '<script src="https://evil.example/x.js"></script>' },
  { name: 'img onerror', value: '<img src=x onerror="window.__xss=1">' },
  { name: 'svg onload', value: '<svg onload="window.__xss=1"></svg>' },
  { name: 'body onload', value: '<body onload="window.__xss=1">' },
  { name: 'iframe srcdoc', value: '<iframe srcdoc="<script>parent.__xss=1</script>"></iframe>' },
  { name: 'iframe src', value: '<iframe src="https://evil.example/"></iframe>' },
  { name: 'details ontoggle', value: '<details open ontoggle="window.__xss=1">x</details>' },
  { name: 'math href', value: '<math href="javascript:window.__xss=1">x</math>' },
  { name: 'object data', value: '<object data="https://evil.example/x.swf"></object>' },
  { name: 'embed src', value: '<embed src="https://evil.example/x.swf">' },
  { name: 'form action', value: '<form action="https://evil.example/"><input name=p></form>' },
  { name: 'button formaction', value: '<button formaction="javascript:window.__xss=1">x</button>' },
  {
    name: 'meta refresh',
    value: '<meta http-equiv="refresh" content="0;url=https://evil.example/">',
  },
  { name: 'base href', value: '<base href="https://evil.example/">' },
  { name: 'link stylesheet', value: '<link rel="stylesheet" href="https://evil.example/x.css">' },
  { name: 'style import', value: '<style>@import url(https://evil.example/x.css);</style>' },
  {
    name: 'style font',
    value: "<style>@font-face{src:url('https://evil.example/f.woff')}</style>",
  },
  {
    name: 'inline style background',
    value: '<div style="background:url(https://evil.example/b.png)">x</div>',
  },
  { name: 'remote image', value: '<img src="https://tracker.example/pixel.gif" width=1 height=1>' },
  { name: 'srcset image', value: '<img srcset="https://tracker.example/a.png 1x">' },
  { name: 'video poster', value: '<video poster="https://tracker.example/p.png"></video>' },
  { name: 'audio src', value: '<audio src="https://tracker.example/a.mp3" autoplay></audio>' },
  { name: 'javascript link', value: '<a href="javascript:window.__xss=1">Click here</a>' },
  { name: 'data link', value: '<a href="data:text/html,<script>alert(1)</script>">open</a>' },
  { name: 'plain javascript url', value: 'javascript:window.__xss=1' },
  { name: 'plain data url', value: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' },
  { name: 'plain https link', value: 'Verify at https://phish.example/login?u=you@example.org' },
  { name: 'phone and address', value: 'Call +1 555 0100 or write to 1 Main St, Springfield' },
  { name: 'html entities', value: '&lt;script&gt;window.__xss=1&lt;/script&gt; &amp;amp;' },
  { name: 'xml cdata', value: '<![CDATA[<script>window.__xss=1</script>]]>' },
  { name: 'html comment', value: '<!-- --><script>window.__xss=1</script><!-- -->' },
  { name: 'unclosed tag', value: '<img src=x onerror=window.__xss=1 ' },
  { name: 'template mustache', value: '{{ constructor.constructor("window.__xss=1")() }}' },
  { name: 'template literal', value: '${window.__xss=1}' },
  { name: 'jinja block', value: '{% for x in meta %}{{ x.qhash }}{% endfor %}' },
  { name: 'vue directive text', value: '<div v-html="x" @click="window.__xss=1">x</div>' },
  // Bidi and invisible characters
  { name: 'right-to-left override', value: 'invoice‮fdp.exe' },
  { name: 'left-to-right override', value: 'abc‭xyz‬' },
  { name: 'right-to-left embedding', value: 'abc‫xyz‬' },
  { name: 'left-to-right embedding', value: 'abc‪xyz‬' },
  { name: 'pop directional formatting', value: 'end‬ here' },
  { name: 'isolates', value: '⁦left⁩ ⁧right⁩ ⁨first⁩' },
  { name: 'bidi marks', value: 'mark‎left‏right؜arabic' },
  { name: 'zero-width characters', value: 'pay​pal‌.‍com⁠' },
  { name: 'byte order mark', value: '﻿bom-prefixed' },
  { name: 'line and paragraph separators', value: 'one two three' },
  { name: 'mixed right-to-left text', value: 'שלום world مرحبا 123 ‏test' },
  { name: 'spoofed address', value: 'support@bank.example‮lpmaxe.live@' },
  // Controls
  { name: 'NUL character', value: 'nul\u0000byte' },
  { name: 'every C0 control', value: `c0:${C0}:end` },
  { name: 'every C1 control', value: `c1:${C1}:end` },
  { name: 'DEL character', value: 'del\u007Fchar' },
  { name: 'carriage returns', value: 'one\rtwo\r\nthree' },
  { name: 'escape sequences', value: '\u001B[31mred\u001B[0m \u001B]0;title\u0007' },
  { name: 'tabs', value: 'a\tb\t\tc' },
  // Size
  { name: '10,000-character line', value: 'A'.repeat(10_000) },
  { name: 'long unbroken URL', value: `https://evil.example/${'x'.repeat(3000)}` },
  { name: '5,000 lines', value: Array.from({ length: 5000 }, (_, i) => `line ${i}`).join('\n') },
  { name: 'combining characters', value: `Z${'̶̵̴'.repeat(200)}algo` },
  { name: 'emoji and astral', value: '😀🙃 𝕏 \u{1F4A9} family 👨‍👩‍👧' },
]

const LIMITS = { subject: 500, sender: 255, fileName: 255 } as const

/** Cut to at most `max` code points (the contract counts characters, not UTF-16 units). */
function cut(value: string, max: number): string {
  return Array.from(value).slice(0, max).join('')
}

/** One item per vector: the vector as subject, From, sender, symbol option, file name and texts. */
export function hostileQuarantineItems(
  startId: number,
  recipient = 'alice@example.org',
): MockQuarantineItem[] {
  return HOSTILE_VECTORS.map((vector, index) => {
    const id = startId + index
    const base = mockQuarantineItem({
      id,
      recipient,
      action: index % 2 === 0 ? 'rejected' : 'junk',
      score: 10 + index,
      subject: cut(vector.value, LIMITS.subject),
      sender: cut(vector.value, LIMITS.sender),
    })
    return {
      ...base,
      symbols: [{ name: 'HOSTILE_VECTOR', score: 3.5, options: [vector.value] }, ...base.symbols],
      content: {
        from: vector.value,
        subject: vector.value,
        recipients: [
          { address: recipient, source: 'to' },
          { address: recipient, source: 'envelope' },
        ],
        textPlain: vector.value,
        textFromHtml: vector.value,
        parserFallback: false,
        attachments: [
          {
            fileName: cut(vector.value, LIMITS.fileName) || 'attachment-0',
            contentType: 'text/html',
            data: vector.value,
          },
        ],
      },
    }
  })
}
