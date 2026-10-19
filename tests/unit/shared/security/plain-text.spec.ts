// Neutralising untrusted text (UI 006 research R9, data-model §2 "PlainText segments"; created by
// UI 008 as its first user, T004): control, bidi override and isolate characters become visible
// markers such as `U+202E`; multi-line text keeps tabs, line breaks and bidi marks and normalises
// CR LF, CR and the Unicode separators to LF; everything else stays as it is.
import { describe, expect, it } from 'vitest'

import { neutralise } from '@/shared/security/plain-text'

const text = (value: string) => ({ kind: 'text', value })
const marker = (codePoint: string) => ({ kind: 'marker', codePoint })

describe('neutralise', () => {
  it('leaves ordinary text alone', () => {
    expect(neutralise('Hello, world <b>&amp;</b>', { multiline: false })).toEqual([
      text('Hello, world <b>&amp;</b>'),
    ])
    expect(neutralise('', { multiline: true })).toEqual([])
  })

  it('marks bidi embeddings, overrides and isolates in both modes', () => {
    expect(neutralise('invoice\u202Efdp.exe', { multiline: false })).toEqual([
      text('invoice'),
      marker('U+202E'),
      text('fdp.exe'),
    ])
    expect(neutralise('a\u2066b\u2069', { multiline: true })).toEqual([
      text('a'),
      marker('U+2066'),
      text('b'),
      marker('U+2069'),
    ])
  })

  it('marks C0 and C1 controls, DEL and the BOM', () => {
    expect(neutralise('a\u0000b\u007Fc\u0085d\uFEFF', { multiline: true })).toEqual([
      text('a'),
      marker('U+0000'),
      text('b'),
      marker('U+007F'),
      text('c'),
      marker('U+0085'),
      text('d'),
      marker('U+FEFF'),
    ])
  })

  it('keeps tabs, line breaks and bidi marks in multi-line text and normalises breaks', () => {
    expect(neutralise('a\tb\r\nc\rd\u2028e\u200Ff', { multiline: true })).toEqual([
      text('a\tb\nc\nd\ne\u200Ff'),
    ])
  })

  it('marks tabs, breaks, bidi marks and separators in single-line values', () => {
    expect(neutralise('a\tb\nc\u200Ed\u2029', { multiline: false })).toEqual([
      text('a'),
      marker('U+0009'),
      text('b'),
      marker('U+000A'),
      text('c'),
      marker('U+200E'),
      text('d'),
      marker('U+2029'),
    ])
  })
})
