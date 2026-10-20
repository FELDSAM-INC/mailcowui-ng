import { createHash } from 'node:crypto'
import { contrastRatio, normalizeHex } from '@/shared/color/contrast'
import type { LogoSetting } from '@/api'
import { inspectLogo, unsafeSvg } from '../factories/logo-image'
import { brandingState, publishUiTexts, publishBrandColors } from '../scenarios/settings-branding'
import { http, problem, scenario } from './context'
import { addViolation, requireAdmin, validationFailed, type Violations } from './domain-rules'

export const settingsBrandingHandlers = [
  http.get('/settings/brand-colors', ({ response }) => {
    const state = scenario(),
      account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const data = brandingState(state).colours
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
  http.patch('/settings/brand-colors', async ({ request, response }) => {
    const state = scenario(),
      account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    if (state.settings.capabilities.demoMode) return response.untyped(problem(403, 'demo-mode'))
    const store = brandingState(state),
      before = store.colours
    if (request.headers.get('if-match') !== before.etag) return response.untyped(problem(412, null))
    const body = await request.json(),
      errors: Violations = {},
      cap = state.settings.capabilities.brandColors
    for (const theme of ['light', 'dark'] as const) {
      const value = body[theme],
        surface = theme === 'light' ? cap.lightReferenceSurface : cap.darkReferenceSurface
      if (value === undefined || value === null) continue
      if (!/^#[0-9a-f]{6}$/i.test(value))
        addViolation(errors, theme, 'invalidFormat', { format: 'hexColor' })
      else {
        const ratio = contrastRatio(value, surface)!
        if (ratio < cap.minimumContrastRatio)
          addViolation(errors, theme, 'insufficientContrast', {
            ratio: Math.floor(ratio * 100) / 100,
            minimum: cap.minimumContrastRatio,
            surface,
          })
      }
    }
    if (Object.keys(errors).length) return response.untyped(validationFailed(errors))
    store.colours = { ...before, etag: `"brand-colours-${++store.revision}"` }
    for (const theme of ['light', 'dark'] as const)
      if (body[theme] !== undefined)
        store.colours[theme] = body[theme] === null ? null : normalizeHex(body[theme])
    publishBrandColors(state)
    return response(200).json({ data: store.colours }, { headers: { ETag: store.colours.etag } })
  }),
  http.get('/settings/logos/{variant}', ({ params, response }) => {
    const state = scenario(),
      account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const data = brandingState(state).logos[params.variant].metadata
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
  http.put('/settings/logos/{variant}', async ({ params, request, response }) => {
    const state = scenario(),
      account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    if (state.settings.capabilities.demoMode) return response.untyped(problem(403, 'demo-mode'))
    const store = brandingState(state),
      before = store.logos[params.variant].metadata
    if (request.headers.get('if-match') !== before.etag) return response.untyped(problem(412, null))
    const bytes = new Uint8Array(await request.arrayBuffer()),
      cap = state.settings.capabilities.logos
    const errors: Violations = {}
    if (bytes.length > cap.maxBytes)
      addViolation(errors, 'body', 'tooLong', { max: cap.maxBytes, unit: 'bytes' })
    const inspected = inspectLogo(bytes)
    if (!inspected.mediaType || !cap.acceptedMediaTypes.includes(inspected.mediaType))
      addViolation(errors, 'body', 'unsupportedImageType', { allowed: cap.acceptedMediaTypes })
    else if (inspected.mediaType === 'image/svg+xml') {
      const violation = unsafeSvg(bytes)
      if (violation) addViolation(errors, 'body', 'unsafeSvgContent', violation)
    } else if (!inspected.width || !inspected.height) addViolation(errors, 'body', 'invalidImage')
    else if (inspected.width > cap.maxWidth || inspected.height > cap.maxHeight)
      addViolation(errors, 'body', 'imageDimensionsExceeded', {
        width: inspected.width,
        height: inspected.height,
        maxWidth: cap.maxWidth,
        maxHeight: cap.maxHeight,
      })
    if (Object.keys(errors).length) return response.untyped(validationFailed(errors))
    const version = createHash('sha256').update(bytes).digest('hex').slice(0, 16)
    const data: LogoSetting = {
      ...inspected,
      variant: params.variant,
      isSet: true,
      sizeBytes: bytes.length,
      url: `/api/v2/public-config/logos/${params.variant}?v=${version}`,
      etag: `"logo-${params.variant}-${version}"`,
    }
    store.logos[params.variant] = { metadata: data, bytes }
    state.publicConfig.logos[params.variant] = { url: data.url!, isDefault: false }
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
  http.delete('/settings/logos/{variant}', ({ params, request, response }) => {
    const state = scenario(),
      account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    if (state.settings.capabilities.demoMode) return response.untyped(problem(403, 'demo-mode'))
    const store = brandingState(state),
      before = store.logos[params.variant].metadata
    if (request.headers.get('if-match') !== before.etag) return response.untyped(problem(412, null))
    store.logos[params.variant] = {
      metadata: {
        variant: params.variant,
        isSet: false,
        mediaType: null,
        sizeBytes: null,
        width: null,
        height: null,
        url: null,
        etag: `"logo-${params.variant}-${++store.revision}"`,
      },
      bytes: null,
    }
    state.publicConfig.logos[params.variant] = { url: '/img/cow_mailcow.svg', isDefault: true }
    return response(204).empty()
  }),
  http.get('/settings/ui-texts', ({ response }) => {
    const state = scenario(),
      account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const data = brandingState(state).texts
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
  http.patch('/settings/ui-texts', async ({ request, response }) => {
    const state = scenario(),
      account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    if (state.settings.capabilities.demoMode) return response.untyped(problem(403, 'demo-mode'))
    const store = brandingState(state),
      before = store.texts
    if (request.headers.get('if-match') !== before.etag) return response.untyped(problem(412, null))
    const body = await request.json(),
      errors: Violations = {}
    for (const field of ['pageTitle', 'productName', 'appsHeading'] as const) {
      const value = body[field]
      if (value !== undefined && /[\u0000-\u001f\u007f]/.test(value))
        addViolation(errors, field, 'invalidFormat', { format: 'singleLine' })
      if (value !== undefined && [...value].length > 255)
        addViolation(errors, field, 'tooLong', { max: 255 })
    }
    for (const [field, value] of [
      ['loginHelpHtml', body.loginHelpHtml],
      ['footerHtml', body.footerHtml],
      ['announcement.text', body.announcement?.text],
    ] as const)
      if (value !== undefined && [...value].length > 65535)
        addViolation(errors, field, 'tooLong', { max: 65535 })
    if (Object.keys(errors).length) return response.untyped(validationFailed(errors))
    store.texts = {
      ...before,
      ...body,
      announcement: { ...before.announcement, ...body.announcement },
      etag: `"ui-texts-${++store.revision}"`,
    }
    publishUiTexts(state)
    return response(200).json({ data: store.texts }, { headers: { ETag: store.texts.etag } })
  }),
]
