// Unpadded, URL-safe base64 (RFC 4648 §5), the encoding of every binary WebAuthn value in the
// contract (`Base64Url`). Used only where the native Level 3 JSON methods are missing (R14).

const ALPHABET = /^[A-Za-z0-9_-]*$/

function toBytes(data: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  return new Uint8Array(data)
}

export function toBase64Url(data: ArrayBuffer | ArrayBufferView): string {
  const view = toBytes(data)
  let binary = ''
  for (let index = 0; index < view.length; index += 0x8000) {
    binary += String.fromCharCode(...view.subarray(index, index + 0x8000))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(value: string): ArrayBuffer {
  if (!ALPHABET.test(value) || value.length % 4 === 1) {
    throw new TypeError('Invalid base64url value')
  }
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}
