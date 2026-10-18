// Copying the one-time secret (FR-066, edge case "clipboard access refused").
import { describe, expect, it, vi } from 'vitest'

import { copyText } from '@/shared/platform/clipboard'

function stubClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value })
}

describe('copyText', () => {
  it('reports copied when the clipboard accepts the text', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    stubClipboard({ writeText })
    await expect(copyText('secret')).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith('secret')
  })

  it('reports refused when the clipboard rejects', async () => {
    stubClipboard({
      writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')),
    })
    await expect(copyText('secret')).resolves.toBe('refused')
  })

  it('reports refused when writeText throws synchronously', async () => {
    stubClipboard({
      writeText: () => {
        throw new TypeError('not allowed')
      },
    })
    await expect(copyText('secret')).resolves.toBe('refused')
  })

  it('reports refused without a clipboard API', async () => {
    stubClipboard(undefined)
    await expect(copyText('secret')).resolves.toBe('refused')
  })
})
