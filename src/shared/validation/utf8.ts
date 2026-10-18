// The UTF-8 size of a text (research R2, UI 004 R8): the API counts comment limits in UTF-8 bytes.
const encoder = new TextEncoder()

/** The number of bytes of `value` in UTF-8. */
export function utf8ByteLength(value: string): number {
  return encoder.encode(value).length
}
