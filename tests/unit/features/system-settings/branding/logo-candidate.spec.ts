import { effectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLogoCandidate } from '@/features/system-settings/composables/useLogoCandidate'

const limits = {
  maxBytes: 100,
  maxWidth: 300,
  maxHeight: 80,
  acceptedMediaTypes: ['image/png'] as const,
}
const bytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])
const file = () => new File([bytes], 'misleading.txt', { type: 'text/plain' })
afterEach(() => vi.unstubAllGlobals())
function setup(
  bitmap: Promise<Pick<ImageBitmap, 'width' | 'height' | 'close'>> = Promise.resolve({
    width: 300,
    height: 80,
    close: vi.fn(),
  }),
) {
  const create = vi.fn(() => 'blob:logo-preview')
  const revoke = vi.fn()
  vi.stubGlobal(
    'URL',
    class extends URL {
      static override createObjectURL = create
      static override revokeObjectURL = revoke
    },
  )
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(() => bitmap),
  )
  const scope = effectScope()
  const candidate = scope.run(() => useLogoCandidate(() => limits))!
  return { scope, candidate, create, revoke }
}
describe('Logo candidate lifecycle (T055)', () => {
  it('uses detected MIME, decodes dimensions and revokes the preview on clear', async () => {
    const { scope, candidate, create, revoke } = setup()
    await candidate.choose(file())
    expect(candidate.value.value).toMatchObject({
      mediaType: 'image/png',
      width: 300,
      height: 80,
      url: 'blob:logo-preview',
    })
    expect((create.mock.calls[0] as unknown as [Blob])[0].type).toBe('image/png')
    candidate.clear()
    expect(revoke).toHaveBeenCalledWith('blob:logo-preview')
    expect(candidate.value.value).toBeNull()
    scope.stop()
  })
  it('rejects oversized content before reading or creating a preview', async () => {
    const { scope, candidate, create } = setup()
    await candidate.choose(new File([new Uint8Array(101)], 'logo.png'))
    expect(candidate.error.value).toMatchObject({ code: 'tooLong', params: { max: 100 } })
    expect(create).not.toHaveBeenCalled()
    scope.stop()
  })
  it('rejects excessive raster dimensions and revokes its temporary URL', async () => {
    const { scope, candidate, revoke } = setup(
      Promise.resolve({ width: 301, height: 80, close: vi.fn() }),
    )
    await candidate.choose(file())
    expect(candidate.error.value).toMatchObject({
      code: 'imageDimensionsExceeded',
      params: { width: 301, maxWidth: 300 },
    })
    expect(candidate.value.value).toBeNull()
    expect(revoke).toHaveBeenCalledWith('blob:logo-preview')
    scope.stop()
  })
  it('revokes the candidate on unmount', async () => {
    const { scope, candidate, revoke } = setup()
    await candidate.choose(file())
    scope.stop()
    expect(candidate.value.value).toBeNull()
    expect(revoke).toHaveBeenCalledWith('blob:logo-preview')
  })
  it('discards and closes a decode finishing after disposal', async () => {
    let resolve!: (value: { width: number; height: number; close: () => void }) => void
    const bitmap = new Promise<{ width: number; height: number; close: () => void }>((done) => {
      resolve = done
    })
    const { scope, candidate, revoke } = setup(bitmap)
    const choosing = candidate.choose(file())
    await vi.waitFor(() => expect(createImageBitmap).toHaveBeenCalled())
    scope.stop()
    expect(revoke).toHaveBeenCalledWith('blob:logo-preview')
    const close = vi.fn()
    resolve({ width: 300, height: 80, close })
    await choosing
    expect(candidate.value.value).toBeNull()
    expect(close).toHaveBeenCalled()
    expect(revoke).toHaveBeenCalledWith('blob:logo-preview')
  })
})
