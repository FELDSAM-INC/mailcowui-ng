import type { IncomingMessage } from 'node:http'

// Development fixtures (including branding uploads) fit within four MiB. Keep memory bounded
// even when an operator deliberately exposes the mock listener or Vite preview proxy.
export const MAX_BODY_BYTES = 4 * 1024 * 1024

export class BodyTooLargeError extends Error {
  constructor() {
    super('Mock request body exceeds four MiB')
  }
}

export async function readBody(req: IncomingMessage): Promise<Buffer> {
  if (Number(req.headers['content-length']) > MAX_BODY_BYTES) throw new BodyTooLargeError()
  const chunks: Buffer[] = []
  let bytes = 0
  // Retain the socket on an early exit so the server can send its 413 response before closing it.
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    const buffer = chunk as Buffer
    bytes += buffer.length
    if (bytes > MAX_BODY_BYTES) {
      req.pause()
      throw new BodyTooLargeError()
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks, bytes)
}
