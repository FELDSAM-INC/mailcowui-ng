// Branding from GET /public-config (FR-001–FR-004, FR-048, research R16, R17). The view model
// below derives from the generated `PublicConfig`: the logo per theme, the announcement only when
// it is shown, and `languages: null` when the configuration could not be loaded. Plain-text fields
// stay plain text; `loginHelpHtml` and `footerHtml` are rendered only through SanitizedHtml.
import { queryOptions, useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'

import {
  api,
  queryKeys,
  requireData,
  type Announcement,
  type AppLink,
  type Language,
  type LoginPageOptions,
  type PublicConfig,
} from '@/api'

import { darkMode } from '../preferences/theme'
import { defaultBranding } from './defaults'

export type AnnouncementType = Announcement['type']

export interface Branding {
  productName: string
  pageTitle: string
  logos: { light: string | null; dark: string | null }
  loginHelpHtml: string | null
  footerHtml: string | null
  /** Present only when the announcement is active and has text. */
  announcement: { text: string; type: AnnouncementType } | null
  loginPage: LoginPageOptions
  /** `null` when unknown: mailcow's default language menu is offered (FR-003). */
  languages: Language[] | null
  defaultLanguage: string | null
  externalIdentityProvider: boolean
  appsLabel: string | null
  appLinks: AppLink[]
  /** False for the built-in defaults. */
  fromServer: boolean
}

export async function fetchPublicConfig(): Promise<PublicConfig> {
  return requireData(await api.GET('/public-config')).data
}

export function publicConfigQuery() {
  return queryOptions({
    queryKey: queryKeys.publicConfig(),
    queryFn: fetchPublicConfig,
    staleTime: 300_000,
  })
}

export function brandingFrom(config: PublicConfig | undefined | null): Branding {
  if (!config) return defaultBranding()
  const { announcement } = config
  return {
    productName: config.productName,
    pageTitle: config.pageTitle,
    logos: { light: config.logos.light.url, dark: config.logos.dark.url },
    loginHelpHtml: config.loginHelpHtml,
    footerHtml: config.footerHtml,
    announcement:
      announcement.active && announcement.text
        ? { text: announcement.text, type: announcement.type }
        : null,
    loginPage: config.loginPage,
    languages: config.languages,
    defaultLanguage: config.defaultLanguage,
    externalIdentityProvider: config.externalIdentityProvider.configured,
    appsLabel: config.appsLabel,
    appLinks: config.appLinks,
    fromServer: true,
  }
}

/** The logo for the theme in use, or null (the product name is shown instead). */
export function logoFor(branding: Branding, dark: boolean): string | null {
  return dark ? branding.logos.dark : branding.logos.light
}

/** The branding of the server, or the defaults while it is missing or failed. */
export function useBranding() {
  const query = useQuery(publicConfigQuery())
  const branding = computed(() => brandingFrom(query.data.value))
  const logo = computed(() => logoFor(branding.value, darkMode.value))
  return { branding, logo, query }
}
