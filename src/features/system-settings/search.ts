// Search only the static catalogue: never request or index saved settings, message bodies or maps.
import type { SettingsCapabilities } from '@/api'
import type { TextRef } from '@/i18n'
import type { SettingsPage, SettingsSection } from './catalogue'

export function normalizeSettingsSearch(text: string, locale: string): string {
  return text
    .toLocaleLowerCase(locale)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
}
interface Candidate {
  section?: { id?: string; title: string; routeName?: string }
  levels: string[][]
}
export interface SettingsSearchPage {
  page: SettingsPage
  title: string
  description: string
  candidates: Candidate[]
}
export interface SettingsSearchResult {
  page: SettingsPage
  title: string
  description: string
  section?: Candidate['section']
}
interface IndexOptions {
  locale: string
  capabilities: SettingsCapabilities
  hasRoute: (name: string) => boolean
  resolve: (text: TextRef) => string
  english: (text: TextRef) => string
}
export function buildSettingsIndex(
  pages: readonly SettingsPage[],
  options: IndexOptions,
): SettingsSearchPage[] {
  const variants = (refs: readonly TextRef[]) => [
    ...new Set(
      refs
        .flatMap((ref) => [options.resolve(ref), options.english(ref)])
        .map((text) => normalizeSettingsSearch(text, options.locale)),
    ),
  ]
  return pages
    .filter((page) => page.visible(options.capabilities) && options.hasRoute(page.routeName))
    .map((page) => {
      const title = options.resolve(page.title)
      const description = options.resolve(page.description)
      const candidate = (section?: SettingsSection): Candidate => ({
        section: section
          ? { id: section.id, title: options.resolve(section.title), routeName: section.routeName }
          : undefined,
        levels: [
          variants([page.title]),
          variants(section ? [section.title] : []),
          variants([...(page.fields ?? []), ...(section?.fields ?? [])]),
          variants([page.description]),
          variants(page.legacyNames ?? []),
        ],
      })
      return {
        page,
        title,
        description,
        candidates: [
          candidate(),
          ...(page.sections ?? [])
            .filter((section) => !section.routeName || options.hasRoute(section.routeName))
            .map(candidate),
        ],
      }
    })
}

/** One best destination per page; catalogue order resolves equal scores and repeated fields. */
export function searchSettings(
  index: readonly SettingsSearchPage[],
  query: string,
  locale: string,
): SettingsSearchResult[] {
  const normalized = normalizeSettingsSearch(query, locale)
  if (!normalized) return []
  const tokens = normalized.split(' ')
  const matches = (haystacks: string[]) =>
    tokens.every((token) => haystacks.some((text) => text.includes(token)))
  return index
    .flatMap((entry, order) => {
      let best: { rank: number; candidate: Candidate } | undefined
      for (const candidate of entry.candidates) {
        const haystacks: string[] = []
        for (const [level, texts] of candidate.levels.entries()) {
          haystacks.push(...texts)
          if (!matches(haystacks)) continue
          const rank =
            level === 0 ? (texts.some((text) => text.startsWith(normalized)) ? 0 : 1) : level + 1
          if (!best || rank < best.rank) best = { rank, candidate }
          break
        }
      }
      return best
        ? [
            {
              rank: best.rank,
              order,
              page: entry.page,
              title: entry.title,
              description: entry.description,
              section: best.candidate.section,
            },
          ]
        : []
    })
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
}
