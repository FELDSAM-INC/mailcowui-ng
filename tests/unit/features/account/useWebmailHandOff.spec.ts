import { effectScope, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { WebmailHandOff } from '@/api'
import type * as WebmailApi from '@/features/account/api/webmail'
import { useWebmailHandOff } from '@/features/account/composables/useWebmailHandOff'

const handOff = vi.hoisted(() => vi.fn())
vi.mock('@/features/account/api/webmail', async (importOriginal) => ({
  ...(await importOriginal<typeof WebmailApi>()),
  createWebmailHandOff: handOff,
}))

afterEach(() => vi.restoreAllMocks())

function setup() {
  const enabled = ref(true)
  const account = ref('anna@example.org')
  const scope = effectScope()
  const onOpened = vi.fn()
  const action = scope.run(() => useWebmailHandOff(enabled, account, onOpened))!
  return { scope, action, enabled, account, onOpened }
}

describe('useWebmailHandOff', () => {
  it('opens the blank tab synchronously, severs its opener and replaces its address after success', async () => {
    let resolve!: (value: WebmailHandOff) => void
    handOff.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const tab = { opener: window, location: { replace: vi.fn() }, close: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    const { action, scope, onOpened } = setup()
    const result = action.open()
    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(tab.opener).toBeNull()
    expect(tab.location.replace).not.toHaveBeenCalled()
    resolve({ mailbox: 'anna@example.org', url: '/SOGo/so/' })
    await result
    expect(tab.location.replace).toHaveBeenCalledWith('/SOGo/so/')
    expect(onOpened).toHaveBeenCalledOnce()
    scope.stop()
    expect(tab.close).not.toHaveBeenCalled()
  })

  it('keeps a safe fallback link when the browser blocks the new tab', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    handOff.mockResolvedValue({ mailbox: 'anna@example.org', url: '/SOGo/so/' })
    const { action, scope } = setup()
    await action.open()
    expect(action.blockedUrl.value).toBe('/SOGo/so/')
    scope.stop()
    expect(action.blockedUrl.value).toBeNull()
  })

  it.each(['https://elsewhere.example/SOGo/', '//elsewhere.example/', 'javascript:alert(1)'])(
    'closes the tab and reports a rejected hand-off address: %s',
    async (url) => {
      const tab = { opener: window, location: { replace: vi.fn() }, close: vi.fn() }
      vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
      handOff.mockResolvedValue({ mailbox: 'anna@example.org', url })
      const { action, scope } = setup()
      await action.open()
      expect(tab.close).toHaveBeenCalledOnce()
      expect(tab.location.replace).not.toHaveBeenCalled()
      expect(action.problem.value).not.toBeNull()
      scope.stop()
    },
  )

  it('closes a failed blank tab and never opens a second tab while pending', async () => {
    let reject!: (error: Error) => void
    handOff.mockImplementation(
      () =>
        new Promise((_done, fail) => {
          reject = fail
        }),
    )
    const tab = { opener: window, location: { replace: vi.fn() }, close: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    const { action, scope } = setup()
    const pending = action.open()
    await action.open()
    expect(open).toHaveBeenCalledOnce()
    reject(new Error('Unavailable'))
    await pending
    expect(tab.close).toHaveBeenCalledOnce()
    expect(action.problem.value).not.toBeNull()
    scope.stop()
  })

  it.each(['unmount', 'account', 'permission'])(
    'does not navigate a late response after %s',
    async (change) => {
      let resolve!: (value: WebmailHandOff) => void
      handOff.mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done
          }),
      )
      const tab = { opener: window, location: { replace: vi.fn() }, close: vi.fn() }
      vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
      const { action, scope, account, enabled } = setup()
      const pending = action.open()
      if (change === 'unmount') scope.stop()
      if (change === 'account') account.value = 'bob@example.org'
      if (change === 'permission') enabled.value = false
      resolve({ mailbox: 'anna@example.org', url: '/SOGo/so/' })
      await pending
      expect(tab.close).toHaveBeenCalledOnce()
      expect(tab.location.replace).not.toHaveBeenCalled()
      expect(action.blockedUrl.value).toBeNull()
      expect(action.problem.value).toBeNull()
      scope.stop()
    },
  )
})
