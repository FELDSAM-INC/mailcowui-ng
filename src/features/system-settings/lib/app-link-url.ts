import type { AppLinkSettingsEntry } from '@/api'
import { safeHref } from '@/shared/security/safe-url'
import { APP_LINK_URL_MAX_LENGTH } from '@/shared/validation/limits'

export type AppLinkError = 'required' | 'singleLine' | 'appLinkUrl' | 'tooLong' | 'limit'
export function appLinkUrlError(value: string, signedIn = false): AppLinkError | null {
  if ([...value].length > APP_LINK_URL_MAX_LENGTH) return 'tooLong'
  if (/\s|[\u0000-\u001f\u007f]/u.test(value) || (!signedIn && value.includes('%u')))
    return 'appLinkUrl'
  // Substitute before parsing, since a username placeholder can occur in the URL's host.
  return safeHref(value.replaceAll('%u', 'user')) ? null : 'appLinkUrl'
}
export function appLinkPreview(
  link: Pick<AppLinkSettingsEntry, 'url' | 'signedInUrl'>,
  username: string,
) {
  const value = link.signedInUrl || link.url
  return appLinkUrlError(value, true) ? null : value.replaceAll('%u', encodeURIComponent(username))
}
export function appLinkErrors(
  links: readonly AppLinkSettingsEntry[],
): Record<string, AppLinkError> {
  const errors: Record<string, AppLinkError> = {}
  if (links.length > 50) errors.links = 'limit'
  links.forEach((link, i) => {
    const name = !link.name.trim()
      ? 'required'
      : [...link.name].length > 255
        ? 'tooLong'
        : /[\u0000-\u001f\u007f]/.test(link.name)
          ? 'singleLine'
          : null
    if (name) errors[`links.${i}.name`] = name
    for (const field of ['url', 'signedInUrl'] as const) {
      const value = link[field]
      if (field === 'signedInUrl' && !value) continue
      const error = appLinkUrlError(value ?? '', field === 'signedInUrl')
      if (error) errors[`links.${i}.${field}`] = error
    }
  })
  return errors
}
export function moveAppLink<T>(links: readonly T[], index: number, direction: -1 | 1): T[] {
  const result = [...links],
    target = index + direction
  if (index < 0 || index >= links.length || target < 0 || target >= links.length) return result
  ;[result[index], result[target]] = [result[target]!, result[index]!]
  return result
}
