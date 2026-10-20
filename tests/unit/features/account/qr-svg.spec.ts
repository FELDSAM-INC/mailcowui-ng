// The QR code under the strict CSP (UI 005 T051, research R10, data-model §2): the factory's
// BaconQrCode-style SVG parses to the allowlisted tree; anything executable, styled, external or
// malformed yields null.
import { describe, expect, it } from 'vitest'

import { parseQrDataUri } from '@/features/account/qr-svg'
import { isOtpauthUri } from '@/features/account/totp'

import { qrDataUri, qrSvg } from '../../../mocks/factories/qr-svg'

const encode = (svg: string) => `data:image/svg+xml;base64,${btoa(svg)}`
const wrap = (inner: string, attrs = 'width="200" height="200" viewBox="0 0 200 200"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${inner}</svg>`

describe('parseQrDataUri', () => {
  it('parses the BaconQrCode-style SVG to the allowlisted tree', () => {
    const tree = parseQrDataUri(qrDataUri('otpauth://totp/anna'))
    expect(tree?.tag).toBe('svg')
    expect(tree?.attrs).toEqual({ width: '200', height: '200', viewBox: '0 0 200 200' })
    expect(tree?.children.map((child) => child.tag)).toEqual(['rect', 'g'])
    const path = tree?.children[1]?.children[0]?.children[0]
    expect(path?.tag).toBe('path')
    expect(path?.attrs['fill-rule']).toBe('evenodd')
    expect(qrSvg('x')).toContain('<path')
  })

  it.each([
    ['a script', wrap('<script>alert(1)</script>')],
    ['foreignObject', wrap('<foreignObject><div>x</div></foreignObject>')],
    ['an event attribute', wrap('<rect x="0" y="0" width="1" height="1" onclick="x()"/>')],
    [
      'an href',
      wrap('<a href="https://evil.example"><rect x="0" y="0" width="1" height="1"/></a>'),
    ],
    ['a style', wrap('<rect x="0" y="0" width="1" height="1" style="fill:red"/>')],
    ['a url() fill', wrap('<rect x="0" y="0" width="1" height="1" fill="url(#g)"/>')],
    ['a rotate transform', wrap('<g transform="rotate(45)"></g>')],
    ['text content', wrap('<g>hello</g>')],
    ['an image', wrap('<image href="data:image/png;base64,AAAA"/>')],
  ])('refuses %s', (_name, svg) => {
    expect(parseQrDataUri(encode(svg))).toBeNull()
  })

  it('refuses other data URIs, bad base64 and parser errors', () => {
    expect(parseQrDataUri('data:image/png;base64,AAAA')).toBeNull()
    expect(parseQrDataUri('data:image/svg+xml,<svg/>')).toBeNull()
    expect(parseQrDataUri('data:image/svg+xml;base64,@@@')).toBeNull()
    expect(parseQrDataUri(encode('<svg><rect></svg>'))).toBeNull()
    expect(parseQrDataUri(encode('<html/>'))).toBeNull()
  })
})

describe('isOtpauthUri', () => {
  it('accepts only otpauth://totp/ addresses', () => {
    expect(isOtpauthUri('otpauth://totp/anna%40example.org?secret=ABC')).toBe(true)
    expect(isOtpauthUri('otpauth://hotp/anna')).toBe(false)
    expect(isOtpauthUri('javascript:alert(1)')).toBe(false)
    expect(isOtpauthUri(null)).toBe(false)
  })
})
