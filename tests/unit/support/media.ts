// A controllable matchMedia fake for jsdom, which has none.
import { vi } from 'vitest'

export interface FakeMediaQueryList extends MediaQueryList {
  setMatches(matches: boolean): void
}

export function installMatchMedia(initial: Record<string, boolean> = {}) {
  const lists = new Map<string, FakeMediaQueryList>()
  const state = new Map(Object.entries(initial))

  function create(query: string): FakeMediaQueryList {
    const listeners = new Set<(event: MediaQueryListEvent) => void>()
    const list = {
      media: query,
      get matches() {
        return state.get(query) ?? false
      },
      onchange: null,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener)
      },
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener)
      },
      addListener: (listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
      removeListener: (listener: (event: MediaQueryListEvent) => void) =>
        listeners.delete(listener),
      dispatchEvent: () => true,
      setMatches(matches: boolean) {
        state.set(query, matches)
        const event = { matches, media: query } as MediaQueryListEvent
        for (const listener of [...listeners]) listener(event)
      },
    }
    return list as unknown as FakeMediaQueryList
  }

  const matchMedia = vi.fn((query: string) => {
    let list = lists.get(query)
    if (!list) {
      list = create(query)
      lists.set(query, list)
    }
    return list
  })
  vi.stubGlobal('matchMedia', matchMedia)

  return {
    matchMedia,
    set(query: string, matches: boolean) {
      const list = lists.get(query)
      if (list) list.setMatches(matches)
      else state.set(query, matches)
    },
  }
}
