// UI 006 T046 (FR-021, data-model §2 "Content preview"): a content part longer than 20 lines or
// 4,000 characters shows its beginning first; the beginning is a prefix of the text and never
// splits a character.
import { describe, expect, it } from 'vitest'

import {
  preview,
  PREVIEW_MAX_CHARS,
  PREVIEW_MAX_LINES,
} from '@/features/quarantine/content-preview'

const lines = (count: number) =>
  Array.from({ length: count }, (_, index) => `Line ${index + 1}`).join('\n')

describe('content preview', () => {
  it('has the limits of the spec', () => {
    expect(PREVIEW_MAX_LINES).toBe(20)
    expect(PREVIEW_MAX_CHARS).toBe(4000)
  })

  it('keeps a short text whole', () => {
    expect(preview(lines(20))).toEqual({ head: lines(20), truncated: false })
    expect(preview('')).toEqual({ head: '', truncated: false })
  })

  it('shows the first 20 lines of a longer text', () => {
    const result = preview(lines(60))
    expect(result.truncated).toBe(true)
    expect(result.head).toBe(lines(20))
    expect(result.head.split('\n')).toHaveLength(20)
  })

  it('counts a trailing line break as no extra line', () => {
    expect(preview(`${lines(20)}\n`).truncated).toBe(false)
  })

  it('cuts a long single line at 4,000 characters without splitting a character', () => {
    const long = `${'a'.repeat(3999)}😀${'b'.repeat(100)}`
    const result = preview(long)
    expect(result.truncated).toBe(true)
    expect(result.head).toBe('a'.repeat(3999))
    expect(preview('x'.repeat(4000))).toEqual({ head: 'x'.repeat(4000), truncated: false })
  })

  it('takes limits from options', () => {
    expect(preview('a\nb\nc', { maxLines: 2 })).toEqual({ head: 'a\nb', truncated: true })
    expect(preview('abcdef', { maxChars: 3 })).toEqual({ head: 'abc', truncated: true })
  })
})
