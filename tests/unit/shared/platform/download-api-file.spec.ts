// UI 006 (T015, research R10): API files are saved, never displayed. `Content-Disposition` parsing
// prefers RFC 8187 `filename*`, names are sanitised again, the blob is octet-stream whatever the
// response type, the object URL is revoked after 1 s, nothing is stored, and a refusal saves
// nothing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiProblem } from '@/api'
import { parseContentDisposition, sanitiseFileName, saveApiFile } from '@/shared/platform/download'

describe('parseContentDisposition', () => {
  it('prefers the RFC 8187 filename* over filename', () => {
    expect(
      parseContentDisposition(
        `attachment; filename="zlutoucky.pdf"; filename*=UTF-8''%C5%BElu%C5%A5ou%C4%8Dk%C3%BD.pdf`,
      ),
    ).toBe('žluťoučký.pdf')
  })

  it("reads the charset'lang'value form with a language", () => {
    expect(parseContentDisposition(`attachment; filename*=utf-8'cs'r%C3%A1d.txt`)).toBe('rád.txt')
  })

  it('reads a quoted filename with an escaped quote and a semicolon', () => {
    expect(parseContentDisposition('attachment; filename="a\\"b;c.txt"')).toBe('a"b;c.txt')
    expect(parseContentDisposition('attachment; filename=plain.eml')).toBe('plain.eml')
  })

  it('gives null without a header or a name', () => {
    expect(parseContentDisposition(null)).toBeNull()
    expect(parseContentDisposition('attachment')).toBeNull()
  })
})

describe('sanitiseFileName', () => {
  it('replaces path separators, controls and bidi characters', () => {
    expect(sanitiseFileName('../../evil.exe', 'x')).toBe('_.._evil.exe')
    expect(sanitiseFileName('a\u0007b.txt', 'x')).toBe('a_b.txt')
    expect(sanitiseFileName('invoice\u{202E}fdp.exe', 'x')).toBe('invoice_fdp.exe')
  })

  it('trims leading dots and trailing dots or spaces', () => {
    expect(sanitiseFileName('.htaccess', 'x')).toBe('htaccess')
    expect(sanitiseFileName('report. . ', 'x')).toBe('report')
  })

  it('cuts a long name to 200 characters, keeping the extension', () => {
    const name = sanitiseFileName(`${'a'.repeat(300)}.pdf`, 'x')
    expect(name).toHaveLength(200)
    expect(name.endsWith('.pdf')).toBe(true)
  })

  it('falls back when nothing is left', () => {
    expect(sanitiseFileName('...', 'attachment-2')).toBe('attachment-2')
  })
})

describe('saveApiFile', () => {
  let blob: Blob | null
  const revoke = vi.fn()
  const clicks: { href: string; download: string; connected: boolean }[] = []

  beforeEach(() => {
    vi.useFakeTimers()
    blob = null
    clicks.length = 0
    revoke.mockReset()
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: vi.fn((value: Blob) => {
          blob = value
          return 'blob:http://localhost/7'
        }),
        revokeObjectURL: revoke,
      }),
    )
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push({ href: this.href, download: this.download, connected: this.isConnected })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves the bytes as octet-stream under the API name and revokes the URL after 1 s', async () => {
    const response = new Response(null, {
      headers: {
        'Content-Disposition': `attachment; filename="r.html"; filename*=UTF-8''r%C3%A1d.html`,
        'Content-Type': 'text/html',
      },
    })
    const data = new Blob(['<script>alert(1)</script>'], { type: 'text/html' })

    // jsdom has no IndexedDB: a stub records any attempt to open a database.
    const open = vi.fn()
    vi.stubGlobal('indexedDB', { open })

    const name = await saveApiFile(() => Promise.resolve({ data, response }), 'attachment-1')

    expect(name).toBe('rád.html')
    expect(clicks).toEqual([
      { href: 'blob:http://localhost/7', download: 'rád.html', connected: false },
    ])
    expect(blob!.type).toBe('application/octet-stream')
    expect(await blob!.text()).toBe('<script>alert(1)</script>')
    vi.advanceTimersByTime(999)
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(revoke).toHaveBeenCalledWith('blob:http://localhost/7')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    expect(open).not.toHaveBeenCalled()
  })

  it('uses the fallback name without Content-Disposition', async () => {
    const name = await saveApiFile(
      () => Promise.resolve({ data: new Blob(['x']), response: new Response(null) }),
      'quarantine-12.eml',
    )
    expect(name).toBe('quarantine-12.eml')
  })

  it('saves nothing when the API refuses', async () => {
    const refusal = ApiProblem.fromParts({ kind: 'problem', status: 409 })
    await expect(saveApiFile(() => Promise.reject(refusal), 'x')).rejects.toBe(refusal)
    expect(clicks).toEqual([])
    expect(blob).toBeNull()
  })
})
