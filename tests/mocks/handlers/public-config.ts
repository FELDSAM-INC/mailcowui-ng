// Public configuration handlers (T026): the configuration with its ETag and 304 revalidation,
// and the operator's logos.
import { createHash } from 'node:crypto'

import { HttpResponse } from 'msw'

import { LOGO_VERSION } from '../scenarios/public-config'
import { existingBranding } from '../scenarios/settings-branding'
import { http, problem, scenario } from './context'

const etagOf = (value: unknown) =>
  `"${createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20)}"`

function logoSvg(variant: 'light' | 'dark'): string {
  const fill = variant === 'light' ? '#465fff' : '#9cb9ff'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40" viewBox="0 0 160 40"><rect width="40" height="40" rx="10" fill="${fill}"/><rect x="52" y="14" width="96" height="12" rx="6" fill="${fill}"/></svg>`
}

export const publicConfigHandlers = [
  http.get('/public-config', ({ request, response }) => {
    const config = scenario().publicConfig
    const etag = etagOf(config)
    if (request.headers.get('if-none-match') === etag) {
      return response(304).empty({ headers: { ETag: etag } })
    }
    return response(200).json(
      { data: config },
      { headers: { ETag: etag, 'Cache-Control': 'no-cache' } },
    )
  }),

  http.get('/public-config/logos/{variant}', ({ params, query, response }) => {
    const variant = params.variant === 'dark' ? 'dark' : 'light'
    const saved = existingBranding(scenario())?.logos[variant]
    if (saved) {
      if (!saved.bytes || !saved.metadata.mediaType) return response.untyped(problem(404, null))
      return response.untyped(
        new HttpResponse(Uint8Array.from(saved.bytes).buffer, {
          status: 200,
          headers: {
            'Content-Type': saved.metadata.mediaType,
            ETag: saved.metadata.etag,
            'Cache-Control': 'no-cache',
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
          },
        }),
      )
    }
    const body = logoSvg(variant)
    const versioned = query.get('v') === LOGO_VERSION
    return response.untyped(
      new HttpResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          ETag: etagOf(body),
          'Cache-Control': versioned ? 'public, max-age=31536000, immutable' : 'no-cache',
          'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        },
      }),
    )
  }),
]
