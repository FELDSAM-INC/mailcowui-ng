// The CSP-safe formatter of mailcow's own strings (constitution IV, research R15): mechanical
// substitution of `%s`, `%d` and positional `%1$s`, and of the DataTables placeholders the caller
// names. Nothing else changes: braces, glyphs, whitespace and markup stay as the file has them.
import { describe, expect, it } from 'vitest'

import { escapeHtml, formatLegacy, hasMarkup, legacySegments } from '@/i18n/legacy-format'

describe('formatLegacy: placeholders', () => {
  it('fills %s and %d in order', () => {
    expect(formatLegacy('Login was delayed by %s seconds.', [5])).toBe(
      'Login was delayed by 5 seconds.',
    )
    expect(formatLegacy('%s of %d', ['a', 7])).toBe('a of 7')
  })

  it('fills positional placeholders by number', () => {
    expect(formatLegacy('%2$s before %1$s', ['one', 'two'])).toBe('two before one')
  })

  it('writes %d numbers as integers, and strings as given', () => {
    expect(formatLegacy('%d items', [3.9])).toBe('3 items')
    expect(formatLegacy('%d items', ['1,024'])).toBe('1,024 items')
  })

  it('leaves a placeholder without an argument as it is', () => {
    expect(formatLegacy('%s and %s', ['x'])).toBe('x and %s')
    expect(formatLegacy('Size: %s')).toBe('Size: %s')
  })

  it('never interprets other percent signs, braces or e-mail template variables', () => {
    expect(formatLegacy('50 % des {username} {{link}} %u %%', ['x'])).toBe(
      '50 % des {username} {{link}} %u %%',
    )
  })

  it('substitutes only the DataTables placeholders it is given', () => {
    expect(
      formatLegacy('Showing _START_ to _END_ of _TOTAL_ entries', [], {
        _START_: 1,
        _END_: 25,
        _TOTAL_: '1,204',
      }),
    ).toBe('Showing 1 to 25 of 1,204 entries')
    expect(formatLegacy('Relay via _MTA_ (_TOTAL_)', [], { _TOTAL_: 2 })).toBe(
      'Relay via _MTA_ (2)',
    )
  })

  it('keeps every glyph and whitespace of the value', () => {
    expect(formatLegacy('> Forgot Password?')).toBe('> Forgot Password?')
    expect(formatLegacy('  a\r\n b ')).toBe('  a\r\n b ')
  })

  it('escapes arguments when asked to, for values with markup', () => {
    expect(formatLegacy('<b>%s</b>', ['<i>x</i> & y'], {}, escapeHtml)).toBe(
      '<b>&lt;i&gt;x&lt;/i&gt; &amp; y</b>',
    )
  })
})

describe('legacySegments', () => {
  it('splits a value at the placeholders that a caller renders itself', () => {
    expect(legacySegments('Show _MENU_ entries', [], {}, ['_MENU_'])).toEqual([
      'Show ',
      { slot: '_MENU_' },
      ' entries',
    ])
  })

  it('substitutes the other placeholders as text', () => {
    expect(legacySegments('%s: _MENU_', ['Page'], {}, ['_MENU_'])).toEqual([
      'Page: ',
      { slot: '_MENU_' },
    ])
  })
})

describe('hasMarkup', () => {
  it('detects tags and character references', () => {
    expect(hasMarkup('The token is invalid.<br>Please request a new link.')).toBe(true)
    expect(hasMarkup('&#10003;')).toBe(true)
    expect(hasMarkup('Use &lt;domain&gt;')).toBe(true)
    expect(hasMarkup('<b>Important:</b> wait')).toBe(true)
  })

  it('treats plain text, comparisons and ampersands as text', () => {
    expect(hasMarkup('> Forgot Password?')).toBe(false)
    expect(hasMarkup('a < b and c > d')).toBe(false)
    expect(hasMarkup('Tom & Jerry')).toBe(false)
    expect(hasMarkup('{username}')).toBe(false)
  })
})
