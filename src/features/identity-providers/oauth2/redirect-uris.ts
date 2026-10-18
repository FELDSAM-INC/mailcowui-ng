// The redirect URI field (FR-058, FR-061). The classic interface has one text field; several URIs
// are separated by spaces, as mailcow stores them (legacy form map, decision 8). The rules are the
// contract's (format `redirectUri`): an absolute URI with a scheme, without a fragment and without
// whitespace; joined by single spaces, without duplicates, at most the capabilities' length.

/** The URIs of the field, split on any whitespace. */
export function splitRedirectUris(value: string): string[] {
  return value.split(/\s+/).filter((uri) => uri !== '')
}

/** The field's text for stored URIs. */
export function joinRedirectUris(uris: readonly string[]): string {
  return uris.join(' ')
}

/** Absolute URI with a scheme (`https:`, or a custom one such as `com.example.app:`). */
export function isRedirectUri(value: string): boolean {
  if (value === '' || /\s/.test(value) || value.includes('#')) return false
  return /^[A-Za-z][A-Za-z0-9+.-]*:\S+$/.test(value)
}

export type RedirectUriProblem =
  | { kind: 'empty' }
  | { kind: 'invalid'; index: number; uri: string }
  | { kind: 'tooLong'; max: number }

/** What breaks the rules, before anything is sent; empty when the URIs may be saved. */
export function redirectUriProblems(
  uris: readonly string[],
  maxLength: number,
): RedirectUriProblem[] {
  if (uris.length === 0) return [{ kind: 'empty' }]
  const problems: RedirectUriProblem[] = []
  uris.forEach((uri, index) => {
    if (!isRedirectUri(uri)) problems.push({ kind: 'invalid', index, uri })
  })
  if ([...new Set(uris)].join(' ').length > maxLength) {
    problems.push({ kind: 'tooLong', max: maxLength })
  }
  return problems
}
