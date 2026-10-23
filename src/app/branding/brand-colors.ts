import type { QueryClient } from '@tanstack/vue-query'
import { queryKeys, type PublicConfig } from '@/api'
import { adjust, hoverColor, referenceSurfaces } from '@/shared/color/contrast'

const subscriptions = new WeakMap<QueryClient, () => void>()
/** CSSOM properties are CSP-compatible. CSS selects the theme without another API read. */
export function installBrandColors(client: QueryClient): () => void {
  const existing = subscriptions.get(client)
  if (existing) return existing
  const key = queryKeys.publicConfig()
  const update = () => {
    const colours = client.getQueryData<PublicConfig>(key)?.brandColors
    for (const theme of ['light', 'dark'] as const) {
      const value = colours?.[theme]
      const properties = {
        '': value?.color,
        '-foreground': value?.foreground,
        '-hover': value && hoverColor(value.color, value.foreground),
        '-text': value && adjust(value.color, referenceSurfaces[theme], 4.5),
      }
      for (const [suffix, colour] of Object.entries(properties)) {
        const property = `--brand-${theme}${suffix}`
        if (colour) document.documentElement.style.setProperty(property, colour)
        else document.documentElement.style.removeProperty(property)
      }
    }
  }
  update()
  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.query.queryKey.length === key.length && event.query.queryKey[0] === key[0]) update()
  })
  const dispose = () => {
    unsubscribe()
    subscriptions.delete(client)
  }
  subscriptions.set(client, dispose)
  return dispose
}
