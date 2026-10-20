import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { installFocusManagement, noteScrollRestored } from '@/app/router/focus'

const cleanups: Array<() => void> = []
function setup() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }],
  })
  cleanups.push(installFocusManagement(router))
  return router
}
async function settled() {
  await nextTick()
  await nextTick()
}
afterEach(() => {
  cleanups.splice(0).forEach((stop) => stop())
  noteScrollRestored(false)
  vi.useRealTimers()
  document.body.replaceChildren()
})

describe('section fragment focus (UI013 T044)', () => {
  it('focuses an encoded heading id on the initial deep link without treating it as CSS', async () => {
    document.body.innerHTML =
      '<main tabindex="-1"><h1>Settings</h1><h2 id="Úprava:email[1]">Email</h2></main>'
    const router = setup()
    await router.push('/system/password-policy#%C3%9Aprava%3Aemail%5B1%5D')
    await settled()
    const target = document.getElementById('Úprava:email[1]')!
    expect(document.activeElement).toBe(target)
    expect(target.getAttribute('tabindex')).toBe('-1')
  })

  it('waits for a lazy section heading and focuses it when the data arrives', async () => {
    document.body.innerHTML =
      '<main tabindex="-1"><h1>Settings</h1><section id="password-reset-email"><p>Loading</p></section></main>'
    const router = setup()
    await router.push('/system/password-policy#password-reset-email')
    await settled()
    expect(document.activeElement?.tagName).not.toBe('H1')
    document.getElementById('password-reset-email')!.innerHTML = '<h2>Reset email</h2>'
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(document.querySelector('#password-reset-email h2')),
    )
  })

  it('falls back after three seconds and ignores a section that appears later', async () => {
    vi.useFakeTimers()
    document.body.innerHTML = '<main tabindex="-1"><h1>Settings</h1></main>'
    const router = setup()
    await router.push('/system/password-policy#missing')
    await settled()
    await vi.advanceTimersByTimeAsync(2999)
    expect(document.activeElement?.tagName).not.toBe('H1')
    await vi.advanceTimersByTimeAsync(1)
    expect(document.activeElement).toBe(document.querySelector('h1'))
    document.querySelector('main')!.insertAdjacentHTML('beforeend', '<h2 id="missing">Late</h2>')
    await settled()
    expect(document.activeElement?.tagName).toBe('H1')
  })

  it('handles malformed fragments safely and ignores targets outside main', async () => {
    document.body.innerHTML =
      '<button id="outside">Menu</button><main tabindex="-1"><h1>Settings</h1></main>'
    const router = setup()
    await router.push('/system#%E0%A4%A')
    await settled()
    expect(document.activeElement).toBe(document.querySelector('h1'))
    vi.useFakeTimers()
    await router.push('/system#outside')
    await settled()
    await vi.advanceTimersByTimeAsync(3000)
    expect(document.activeElement).toBe(document.querySelector('h1'))
  })

  it('supports a hash-only change while preserving focus during a query-only change', async () => {
    document.body.innerHTML =
      '<main tabindex="-1"><h1>Settings</h1><input id="search"><h2 id="email">Email</h2></main>'
    const router = setup()
    await router.push('/system')
    await settled()
    await router.push('/system#email')
    await settled()
    expect(document.activeElement?.id).toBe('email')
    document.getElementById('search')!.focus()
    await router.push('/system?q=body#email')
    await settled()
    expect(document.activeElement?.id).toBe('search')
  })

  it('does not steal focus when the user chooses another control while waiting', async () => {
    document.body.innerHTML = '<main tabindex="-1"><h1>Settings</h1><input id="search"></main>'
    const router = setup()
    await router.push('/system#later')
    await settled()
    document.getElementById('search')!.focus()
    document.querySelector('main')!.insertAdjacentHTML('beforeend', '<h2 id="later">Late</h2>')
    await settled()
    expect(document.activeElement?.id).toBe('search')
  })

  it('cancels a pending section when navigation is superseded and retains normal h1 focus', async () => {
    document.body.innerHTML = '<main tabindex="-1"><h1>Settings</h1></main>'
    const router = setup()
    await router.push('/system#later')
    await settled()
    await router.push('/domains')
    await settled()
    expect(document.activeElement?.tagName).toBe('H1')
    document.querySelector('main')!.insertAdjacentHTML('beforeend', '<h2 id="later">Late</h2>')
    await settled()
    expect(document.activeElement?.tagName).toBe('H1')
  })

  it('preserves restored scroll when focusing a matching fragment', async () => {
    document.body.innerHTML =
      '<main tabindex="-1"><h1>Settings</h1><h2 id="email">Email</h2></main>'
    const heading = document.getElementById('email')!
    const focus = vi.spyOn(heading, 'focus')
    noteScrollRestored(true)
    const router = setup()
    await router.push('/system#email')
    await settled()
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  })
})
