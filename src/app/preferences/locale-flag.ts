/** Flags decorate language names; the server's language name remains the accessible label. */
export function localeFlag(locale: string): string {
  const region = /^[a-z]{2}-([a-z]{2})$/i.exec(locale)?.[1]?.toUpperCase()
  return region
    ? String.fromCodePoint(...[...region].map((letter) => letter.charCodeAt(0) + 127397))
    : ''
}
