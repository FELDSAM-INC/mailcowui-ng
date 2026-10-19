// Text downloads under the strict CSP (conventions "Shared building blocks": downloads; UI 010
// research R13): a Blob with exactly the given text (no byte order mark, no newline conversion),
// clicked through a detached `<a download>` and revoked right after. Never a `data:` URL, never
// storage. First used by UI 010 (zone files, private key exports); UI 005 reuses it.

export function downloadText(text: string, fileName: string, mediaType: string): void {
  const blob = new Blob([text], { type: `${mediaType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
