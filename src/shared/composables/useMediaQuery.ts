// Reactive media query (for example the `lg` breakpoint of the shell). Without matchMedia it is
// false.
import { onScopeDispose, ref, type Ref } from 'vue'

export function useMediaQuery(query: string): Ref<boolean> {
  const matches = ref(false)
  if (typeof window.matchMedia !== 'function') return matches
  const list = window.matchMedia(query)
  matches.value = list.matches
  const listener = (event: MediaQueryListEvent) => {
    matches.value = event.matches
  }
  list.addEventListener('change', listener)
  onScopeDispose(() => list.removeEventListener('change', listener))
  return matches
}
