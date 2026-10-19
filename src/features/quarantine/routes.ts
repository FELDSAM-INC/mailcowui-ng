// The routes of UI 006's quarantine area (data-model §5 as the legacy form map changes it). Every
// page is lazy-loaded together with the feature's strings (`loadFeatureMessages('quarantine')`),
// which the shell does not bundle. Pages narrower than the Quarantine entry carry `meta.roles`
// (UI 002 D4); pages of the section navigation carry `meta.sectionNav` (`QuarantineSectionNav`).
// Literal paths sit next to `/quarantine/:itemId(\d+)`, which matches digits only.
import type { RouteRecordRaw } from 'vue-router'

import { loadFeatureMessages } from '@/i18n'

/** A page and the 006 strings, loaded together. */
export function page<T>(load: () => Promise<T>): () => Promise<T> {
  return () => Promise.all([load(), loadFeatureMessages('quarantine')]).then(([module]) => module)
}

export const quarantineRoutes: RouteRecordRaw[] = []
