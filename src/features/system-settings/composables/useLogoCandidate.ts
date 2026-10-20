import { onScopeDispose, ref, shallowRef } from 'vue'
import type { SettingsCapabilities } from '@/api'
import { detectLogoMediaType, readLogoBytes, type LogoMediaType } from '../lib/logo-file'

type Limits = Omit<SettingsCapabilities['logos'], 'acceptedMediaTypes'> & {
  acceptedMediaTypes: Readonly<SettingsCapabilities['logos']['acceptedMediaTypes']>
}
export interface LogoCandidate {
  file: File
  mediaType: LogoMediaType
  url: string
  width: number | null
  height: number | null
}
export interface LogoCandidateError {
  code: 'tooLong' | 'unsupportedImageType' | 'imageDimensionsExceeded' | 'invalidImage'
  params: Record<string, number | string | readonly string[]>
}

async function dimensions(blob: Blob, url: string) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob)
    const result = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return result
  }
  const image = new Image()
  image.src = url
  await image.decode()
  return { width: image.naturalWidth, height: image.naturalHeight }
}

export function useLogoCandidate(limits: () => Limits) {
  const value = shallowRef<LogoCandidate | null>(null)
  const error = shallowRef<LogoCandidateError | null>(null)
  const pending = ref(false)
  let generation = 0
  let disposed = false
  const pendingUrls = new Set<string>()
  function releasePending(url: string) {
    if (pendingUrls.delete(url)) URL.revokeObjectURL(url)
  }
  function clear() {
    generation++
    for (const url of pendingUrls) releasePending(url)
    if (value.value) URL.revokeObjectURL(value.value.url)
    value.value = null
    error.value = null
    pending.value = false
  }
  async function choose(file: File) {
    if (disposed) return
    clear()
    const turn = generation
    const current = () => !disposed && turn === generation
    const cap = limits()
    if (file.size > cap.maxBytes) {
      error.value = { code: 'tooLong', params: { max: cap.maxBytes, unit: 'bytes' } }
      return
    }
    pending.value = true
    let url: string | undefined
    try {
      const mediaType = detectLogoMediaType(await readLogoBytes(file))
      if (!current()) return
      if (!mediaType || !cap.acceptedMediaTypes.includes(mediaType)) {
        error.value = { code: 'unsupportedImageType', params: { allowed: cap.acceptedMediaTypes } }
        return
      }
      // Do not let a misleading browser MIME type change how the image preview is decoded.
      const blob = new Blob([file], { type: mediaType })
      url = URL.createObjectURL(blob)
      pendingUrls.add(url)
      const size =
        mediaType === 'image/svg+xml' ? { width: null, height: null } : await dimensions(blob, url)
      if (!current()) return
      if (
        size.width !== null &&
        size.height !== null &&
        (size.width > cap.maxWidth || size.height > cap.maxHeight)
      ) {
        error.value = {
          code: 'imageDimensionsExceeded',
          params: { ...size, maxWidth: cap.maxWidth, maxHeight: cap.maxHeight },
        }
        return
      }
      value.value = { file, mediaType, url, ...size }
      pendingUrls.delete(url)
      url = undefined
    } catch {
      if (current()) error.value = { code: 'invalidImage', params: {} }
    } finally {
      if (url) releasePending(url)
      if (current()) pending.value = false
    }
  }
  onScopeDispose(() => {
    disposed = true
    clear()
  })
  return { value, error, pending, choose, clear }
}
