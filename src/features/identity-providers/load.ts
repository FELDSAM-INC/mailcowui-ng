// A page of UI 012 and the feature's own strings, loaded together (docs/conventions.md, "New
// strings": the shell does not bundle `src/i18n/messages/identity-providers/`).
import { loadFeatureMessages } from '@/i18n'

export function page<T>(load: () => Promise<T>): () => Promise<T> {
  return () =>
    Promise.all([load(), loadFeatureMessages('identityProviders')]).then(([module]) => module)
}
