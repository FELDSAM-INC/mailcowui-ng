import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { detectLogoMediaType } from '@/features/system-settings/lib/logo-file'

describe('Logo content classification (T055)', () => {
  it.each([
    ['logo-300x80.png', 'image/png'],
    ['logo.jpg', 'image/jpeg'],
    ['logo-animated.gif', 'image/gif'],
    ['logo.svg', 'image/svg+xml'],
    ['logo-no-size.svg', 'image/svg+xml'],
    // The API owns SVG safety checks. The UI previews these only as images.
    ['logo-script.svg', 'image/svg+xml'],
    ['pdf-named-logo.png', null],
  ])('classifies %s by content', (file, expected) => {
    expect(detectLogoMediaType(readFileSync(`tests/fixtures/logos/${file}`))).toBe(expected)
  })
  it.each([
    '\ufeff<?xml version="1.0"?>\n<!-- banner -->\n<svg xmlns="http://www.w3.org/2000/svg"/>',
    '<!-- <html/> --><!DOCTYPE svg [ <!ENTITY test "ignored"> ]><svg/>',
  ])('recognises the SVG root after allowed prolog syntax', (source) => {
    expect(detectLogoMediaType(new TextEncoder().encode(source))).toBe('image/svg+xml')
  })
  it.each(['', '<html><svg/></html>', '<!-- <svg/> -->', 'text <svg/>', '%PDF-1.7'])(
    'rejects %j',
    (source) => {
      expect(detectLogoMediaType(new TextEncoder().encode(source))).toBeNull()
    },
  )
})
