import { ApiProblem } from './problem'

// Clearing QueryClient does not cancel running mutations or their callbacks. A generation also
// distinguishes signing back into the same account from the session that started the request.
let generation = 0

export function invalidateSessionScope(): void {
  generation++
}

export function captureSessionScope() {
  const owner = generation
  const isCurrent = () => owner === generation
  const assertCurrent = () => {
    if (!isCurrent()) throw ApiProblem.fromParts({ kind: 'identityChanged' })
  }
  return {
    isCurrent,
    assertCurrent,
    async run<T>(operation: () => Promise<T> | T): Promise<T> {
      assertCurrent()
      try {
        const value = await operation()
        assertCurrent()
        return value
      } catch (error) {
        assertCurrent()
        throw error
      }
    },
  }
}
