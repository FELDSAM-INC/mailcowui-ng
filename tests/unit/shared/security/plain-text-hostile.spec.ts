// UI 006 (T013, T014, research R9, SC-002): every vector of the hostile corpus is neutralised into
// text and marker segments only, every bidi or control character becomes a marker, and PlainText
// creates no element from the data in either mode.
import { describe, expect, it } from 'vitest'

import PlainText from '@/shared/components/PlainText.vue'
import { neutralise } from '@/shared/security/plain-text'

import { HOSTILE_VECTORS } from '../../../mocks/factories/hostile-messages'
import { mountWithApp } from '../../support/mount'

// Bidi embeddings, overrides and isolates, C0 and C1 controls, DEL and the BOM: markers in both
// modes (tab and line feed are kept in multi-line text).
const ALWAYS_MARKED =
  /[\u{0}-\u{8}\u{B}-\u{C}\u{E}-\u{1F}\u{7F}-\u{9F}\u{202A}-\u{202E}\u{2066}-\u{2069}\u{FEFF}]/u

describe('the hostile corpus', () => {
  it('has at least 50 vectors', () => {
    expect(HOSTILE_VECTORS.length).toBeGreaterThanOrEqual(50)
  })

  it.each(HOSTILE_VECTORS.map((vector) => [vector.name, vector.value] as const))(
    '%s is neutralised in both modes',
    (_name, value) => {
      for (const multiline of [false, true]) {
        const segments = neutralise(value, { multiline })
        expect(
          segments.every((segment) => segment.kind === 'text' || segment.kind === 'marker'),
        ).toBe(true)
        for (const segment of segments) {
          if (segment.kind === 'text') expect(ALWAYS_MARKED.test(segment.value)).toBe(false)
          else expect(segment.codePoint).toMatch(/^U\+[0-9A-F]{4,6}$/)
        }
        if (!multiline) {
          for (const segment of segments) {
            if (segment.kind === 'text')
              expect(segment.value).not.toMatch(/[\n\r\t\u{2028}\u{2029}]/u)
          }
        }
      }
    },
  )

  it('creates no element and no attribute from any vector', () => {
    for (const vector of HOSTILE_VECTORS) {
      for (const multiline of [false, true]) {
        const wrapper = mountWithApp(PlainText, { props: { value: vector.value, multiline } })
        const elements = [...wrapper.element.querySelectorAll('*')]
        expect(elements.every((element) => ['SPAN'].includes(element.tagName))).toBe(true)
        for (const element of [wrapper.element, ...elements]) {
          for (const attribute of element.getAttributeNames()) {
            expect(['class', 'dir', 'data-plain-text', 'data-marker']).toContain(attribute)
          }
        }
        wrapper.unmount()
      }
    }
  })
})
