import { readFileSync } from 'node:fs'
import type { BrandColors, LogoSetting, UiTexts } from '@/api'
import { foreground } from '@/shared/color/contrast'
import type { ScenarioDefinition } from './index'
import type { ScenarioState } from './state'

interface BrandingState {
  logos: Record<LogoSetting['variant'], { metadata: LogoSetting; bytes: Uint8Array | null }>
  texts: UiTexts
  colours: BrandColors
  revision: number
}
const stores = new WeakMap<ScenarioState, BrandingState>()
export const existingBranding = (state: ScenarioState) => stores.get(state)
export function brandingState(state: ScenarioState): BrandingState {
  const existing = stores.get(state)
  if (existing) return existing
  const logo = (variant: LogoSetting['variant']): BrandingState['logos']['light'] => {
    const isSet = !state.publicConfig.logos[variant].isDefault
    const bytes = isSet
      ? new TextEncoder().encode(
          '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40"><rect width="160" height="40" fill="#465fff"/></svg>',
        )
      : null
    return {
      metadata: {
        variant,
        isSet,
        mediaType: isSet ? 'image/svg+xml' : null,
        sizeBytes: bytes?.length ?? null,
        width: isSet ? 160 : null,
        height: isSet ? 40 : null,
        url: isSet ? state.publicConfig.logos[variant].url : null,
        etag: `"logo-${variant}-1"`,
      },
      bytes,
    }
  }
  const result: BrandingState = {
    logos: { light: logo('light'), dark: logo('dark') },
    texts: {
      pageTitle: '',
      pageTitleDefault: state.publicConfig.pageTitle,
      productName: '',
      productNameDefault: state.publicConfig.productName,
      appsHeading: state.publicConfig.appsLabel ?? '',
      loginHelpHtml: state.publicConfig.loginHelpHtml ?? '',
      footerHtml: state.publicConfig.footerHtml ?? '',
      announcement: {
        ...state.publicConfig.announcement,
        text: state.publicConfig.announcement.text ?? '',
      },
      etag: '"ui-texts-1"',
    },
    colours: {
      light: null,
      dark: null,
      effective: { light: null, dark: null },
      etag: '"brand-colours-1"',
    },
    revision: 1,
  }
  stores.set(state, result)
  return result
}
export function publishUiTexts(state: ScenarioState) {
  const text = brandingState(state).texts
  Object.assign(state.publicConfig, {
    pageTitle: text.pageTitle || text.pageTitleDefault,
    productName: text.productName || text.productNameDefault,
    appsLabel: text.appsHeading || null,
    loginHelpHtml: text.loginHelpHtml || null,
    footerHtml: text.footerHtml || null,
    announcement: { ...text.announcement },
  })
}
export function publishBrandColors(state: ScenarioState) {
  const colours = brandingState(state).colours
  const dark = colours.dark ?? colours.light
  colours.effective = {
    light: colours.light ? { color: colours.light, foreground: foreground(colours.light)! } : null,
    dark: dark ? { color: dark, foreground: foreground(dark)! } : null,
  }
  state.publicConfig.brandColors = structuredClone(colours.effective)
}
function seedColours(light: string | null, dark: string | null): ScenarioDefinition {
  return {
    description: 'Theme-specific brand colours with the API effective-colour rules.',
    overrides: { signedInAs: 'admin' },
    setup(state) {
      Object.assign(brandingState(state).colours, { light, dark })
      publishBrandColors(state)
    },
  }
}
function seedLogo(state: ScenarioState, variant: LogoSetting['variant'], file: string) {
  const bytes = new Uint8Array(readFileSync(`tests/fixtures/logos/${file}`))
  const mediaType = file.endsWith('.svg') ? 'image/svg+xml' : 'image/png'
  brandingState(state).logos[variant] = {
    bytes,
    metadata: {
      variant,
      isSet: true,
      mediaType,
      sizeBytes: bytes.length,
      width: 300,
      height: 80,
      url: `/api/v2/public-config/logos/${variant}?v=12345678`,
      etag: `"logo-${variant}-12345678"`,
    },
  }
  state.publicConfig.logos[variant] = {
    url: brandingState(state).logos[variant].metadata.url!,
    isDefault: false,
  }
}
export const settingsBrandingScenarios: Record<string, ScenarioDefinition> = {
  'brand-colours-none': seedColours(null, null),
  'brand-colours-set': seedColours('#1d4ed8', '#60a5fa'),
  'brand-colours-light-only': seedColours('#1d4ed8', null),
  'brand-colours-limit': seedColours('#767676', '#8f8f8f'),
  'brand-colours-extreme': seedColours('#0f766e', '#f472b6'),
  'branding-light-logo': {
    description: 'A custom light logo and the deployment default for dark mode.',
    overrides: { signedInAs: 'admin' },
    setup(state) {
      state.publicConfig.logos.dark = { url: '/img/cow_mailcow.svg', isDefault: true }
      seedLogo(state, 'light', 'logo-300x80.png')
    },
  },
  'branding-legacy-unsafe-svg': {
    description: 'A legacy SVG stays readable only as an image.',
    overrides: { signedInAs: 'admin' },
    setup(state) {
      seedLogo(state, 'light', 'logo-script.svg')
    },
  },
  'ui-texts-custom': {
    description: 'Custom UI texts with API-provided deployment defaults.',
    overrides: { signedInAs: 'admin' },
    setup(state) {
      Object.assign(brandingState(state).texts, {
        pageTitle: 'Custom title',
        productName: 'Custom Mail',
        appsHeading: 'Our apps',
      })
      publishUiTexts(state)
    },
  },
  'announcement-warning-active': {
    description: 'An active warning announcement.',
    overrides: { signedInAs: 'admin' },
    setup(state) {
      brandingState(state)
    },
  },
  'help-text-malicious': {
    description: 'Operator HTML requiring sanitization in every preview.',
    overrides: { signedInAs: 'admin' },
    setup(state) {
      brandingState(state).texts.loginHelpHtml =
        '<p onclick="window.htmlExecuted=true">Help <a href="https://help.example.org/">contact us</a><script>window.htmlExecuted=true</script><img src="//evil.example/track"><iframe src="https://evil.example"></iframe></p><style>body{display:none}</style>'
      publishUiTexts(state)
    },
  },
}
