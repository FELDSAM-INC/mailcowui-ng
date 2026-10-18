// App links (FR-001a, data-model §2 AppLinkView, research R17). Addresses are operator data: only
// http(s) and same-origin paths are rendered. On the sign-in screens only links shown on the login
// page appear; the header uses the signed-in address with `%u` replaced by the encoded username.
import type { AppLink } from '@/api'
import { lt } from '@/i18n'
import { safeHref } from '@/shared/security/safe-url'

export interface AppLinkView {
  name: string
  href: string
  description: string | null
}

function view(link: AppLink, address: string): AppLinkView | null {
  const href = safeHref(address)
  return href ? { name: link.name, href, description: link.description } : null
}

export function loginPageLinks(links: readonly AppLink[]): AppLinkView[] {
  return links
    .filter((link) => link.showOnLoginPage)
    .map((link) => view(link, link.url))
    .filter((link): link is AppLinkView => link !== null)
}

export function signedInLinks(links: readonly AppLink[], username: string): AppLinkView[] {
  const encoded = encodeURIComponent(username)
  return links
    .map((link) => view(link, link.signedInUrl.replaceAll('%u', encoded)))
    .filter((link): link is AppLinkView => link !== null)
}

/** The operator's "Apps" text, or the classic interface's default (`header.apps`). */
export function appsLabel(label: string | null): string {
  return label ? label : lt('header.apps')
}
