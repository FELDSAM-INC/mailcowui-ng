// Text downloads under the strict CSP (UI 010 T014, research R13): a Blob with exactly the given
// text, a detached link with the file name, the object URL revoked after the click, nothing stored.
import { afterEach, describe, expect, it, vi } from 'vitest'

import { downloadText } from '@/shared/platform/download'

describe('downloadText', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves the text byte for byte under the file name and revokes the object URL', async () => {
    vi.useFakeTimers()
    let blob: Blob | null = null
    const create = vi.fn((value: Blob) => {
      blob = value
      return 'blob:http://localhost/1'
    })
    const revoke = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }))
    const clicks: { href: string; download: string; connected: boolean }[] = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push({ href: this.href, download: this.download, connected: this.isConnected })
    })
    const text = '$ORIGIN example.org.\r\n@\tIN\tMX\t10 mail.example.org.\n'

    downloadText(text, 'example.org.txt', 'text/plain')

    expect(click).toHaveBeenCalledTimes(1)
    expect(clicks[0]).toEqual({
      href: 'blob:http://localhost/1',
      download: 'example.org.txt',
      connected: false,
    })
    expect(blob!.type).toBe('text/plain;charset=utf-8')
    expect(await blob!.text()).toBe(text)
    const bytes = new Uint8Array(await blob!.arrayBuffer())
    expect(bytes[0]).toBe(0x24) // "$": no byte order mark
    expect(revoke).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revoke).toHaveBeenCalledWith('blob:http://localhost/1')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
})
