// T021/T179, reconciled with the owner's shared tabs and combined Password Settings page.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import contract from '../../../../contract/openapi.json'
import { hasLegacy, i18n, loadFeatureMessages, type TextRef } from '@/i18n'
import { settingsGroups, settingsPages } from '@/features/system-settings/catalogue'
import { systemSettingsRoutes } from '@/features/system-settings/routes'
import { settingsCapabilities } from '../../../mocks/factories/settings'

const root = resolve(import.meta.dirname, '../../../..')
const feature = resolve(root, 'src/features/system-settings')
const source = (path: string) => readFileSync(path, 'utf8')
const routesSource = source(resolve(feature, 'routes.ts'))
const pageFiles = new Map(
  [
    ...routesSource.matchAll(/name:\s*'([^']+)',\s*component:\s*\(\)\s*=>\s*import\('([^']+)'\)/g),
  ].map((match) => [match[1]!, resolve(feature, match[2]!)]),
)
const router = createRouter({ history: createMemoryHistory(), routes: systemSettingsRoutes })

/** Follow local display components and field definitions, without executing/importing pages. */
function sourceTree(file: string, seen = new Set<string>()): string {
  if (seen.has(file)) return ''
  seen.add(file)
  const text = source(file)
  return (
    text +
    [...text.matchAll(/from\s+['"](\.[^'"]+)['"]/g)]
      .map((match) => {
        const path = resolve(dirname(file), match[1]!)
        const dependency = [path, `${path}.ts`, `${path}.vue`].find((candidate) =>
          existsSync(candidate),
        )
        return dependency?.startsWith(feature) && !dependency.includes('/api/')
          ? sourceTree(dependency, seen)
          : ''
      })
      .join('\n')
  )
}
function hasAnchor(text: string, id: string): boolean {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (new RegExp(`<(?:h[1-6]|section)\\b[^>]*\\bid="${escaped}"`).test(text)) return true
  if (id.startsWith('section-')) {
    const key = id.slice('section-'.length)
    if (text.includes(`section-id="${key}"`)) return true
    // UiTextSection/SignInPageSection pass the iterable's named section to EditableSection.
    return (
      text.includes(':section-id="id"') &&
      text.includes(':section-id="sectionId"') &&
      (text.includes(`'${key}'`) || text.includes(`${key}:`))
    )
  }
  if (/^logo-(light|dark)-heading$/.test(id)) {
    return text.includes('`logo-${variant}-heading`') && text.includes("['light', 'dark']")
  }
  return (
    contract.components.schemas.GlobalSieveFilter.properties.id.enum.some(
      (value) => id === `${value}-title`,
    ) && text.includes('`${filter.id}-title`')
  )
}
function textExists(ref: TextRef) {
  expect(
    typeof ref === 'string' ? i18n.global.te(ref, 'en-gb') : hasLegacy(ref.legacy),
    JSON.stringify(ref),
  ).toBe(true)
}
beforeAll(() => loadFeatureMessages('system-settings'))

describe('complete settings discovery catalogue', () => {
  it('covers all planned destinations using the approved consolidated routes', () => {
    const model = source(resolve(root, 'specs/013-system-settings/data-model.md'))
      .split('## 10. Settings catalogue')[1]!
      .split('## 11.')[0]!
    const planned = [...model.matchAll(/^\| `([^`]+)` \|/gm)].map((match) =>
      match[1] === 'password-reset-email'
        ? 'password-policy'
        : match[1] === 'global-sieve-filters'
          ? 'global-sieve'
          : match[1]!,
    )
    expect(new Set(settingsPages.map((page) => page.id))).toEqual(new Set(planned))
    expect(settingsPages).toHaveLength(16)
    expect(new Set(settingsGroups).size).toBe(7)
    expect(
      router.resolve({ name: 'system-settings-password-reset-email' }).matched.at(-1)?.redirect,
    ).toEqual({ name: 'system-settings-password-policy', hash: '#password-reset-email' })
  })
  it('resolves every page to an existing lazy component, translated label and valid audit target', () => {
    for (const page of settingsPages) {
      expect(router.hasRoute(page.routeName), page.id).toBe(true)
      const file = pageFiles.get(page.routeName)
      expect(file && existsSync(file), page.routeName).toBe(true)
      expect(source(file!), page.id).toContain('<template>')
      expect(contract.components.schemas.AuditTarget.properties.type.enum).toContain(
        page.auditTarget,
      )
      textExists(page.title)
      textExists(page.description)
      for (const label of [...(page.fields ?? []), ...(page.legacyNames ?? [])]) textExists(label)
      for (const section of page.sections ?? []) {
        textExists(section.title)
        section.fields?.forEach(textExists)
        if (section.routeName) expect(router.hasRoute(section.routeName)).toBe(true)
      }
    }
  })
  it('keeps every indexed section anchored to a real heading or shared headed section', () => {
    const shared = source(resolve(root, 'src/shared/components/EditableSection.vue'))
    expect(shared).toContain(':id="`section-${sectionId}`"')
    expect(shared).toContain(':id="headingId"')
    expect(shared).toContain('`section-${props.sectionId}-title`')
    for (const page of settingsPages) {
      const text = sourceTree(pageFiles.get(page.routeName)!)
      for (const section of page.sections ?? [])
        if (section.id) expect(hasAnchor(text, section.id), `${page.id}#${section.id}`).toBe(true)
    }
  })
  it('hides only License when verification is unavailable', () => {
    const visible = settingsCapabilities(),
      hidden = settingsCapabilities({ licenseVerificationEnabled: false })
    expect(settingsPages.filter((page) => !page.visible(visible))).toEqual([])
    expect(settingsPages.filter((page) => !page.visible(hidden)).map((page) => page.id)).toEqual([
      'license',
    ])
  })
})
