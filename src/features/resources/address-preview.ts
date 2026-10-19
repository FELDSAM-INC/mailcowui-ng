// The address of a new resource (FR-045, research R14), as the server derives it (contract
// `ResourceCreateRequest`, legacy `preg_replace('/[^\da-z]/i', '', $description)`): the ASCII
// letters and digits of the description in their letter case; no address when none remain or more
// than 64 do. The server's answer stays authoritative.
const LOCAL_PART_MAX = 64

export function derivedLocalPart(description: string): string {
  return description.replace(/[^0-9a-z]/gi, '')
}

/** The previewed address at the readable domain, or null when no address can be derived. */
export function previewAddress(description: string, domainUnicode: string | null): string | null {
  const local = derivedLocalPart(description)
  if (local === '' || local.length > LOCAL_PART_MAX) return null
  return `${local}@${domainUnicode ?? '…'}`
}
