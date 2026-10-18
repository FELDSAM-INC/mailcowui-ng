// mailcow's own translations, loaded at runtime (constitution IV 1.3.0, research R15): the
// installation's `/lang/lang.<code>.json` over its `lang.en-gb.json`, merged as the classic
// interface merges them, and the bundled upstream snapshot only when `/lang/` cannot be loaded.
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, watchEffect } from 'vue'

import {
  legacyStatus,
  loadLegacy,
  lt,
  mergeLegacy,
  prefetchLegacy,
  resetLegacy,
  hasLegacy,
} from '@/i18n/legacy'

import { server } from '../../mocks/node'

beforeEach(() => {
  resetLegacy()
})

afterEach(() => {
  resetLegacy()
})

describe('mergeLegacy', () => {
  it('replaces keys section by section, as array_merge_real does', () => {
    const merged = mergeLegacy(
      { login: { login: 'Login', password: 'Password' }, header: { apps: 'Apps' } },
      { login: { login: 'Přihlásit' } },
    )
    expect(merged).toEqual({
      login: { login: 'Přihlásit', password: 'Password' },
      header: { apps: 'Apps' },
    })
  })

  it('replaces a nested group as a whole, like PHP array_merge one level down', () => {
    const merged = mergeLegacy(
      { datatables: { paginate: { next: 'Next', previous: 'Previous' }, info: 'Showing' } },
      { datatables: { paginate: { next: 'Další' } } },
    )
    expect(merged).toEqual({ datatables: { paginate: { next: 'Další' }, info: 'Showing' } })
  })
})

describe('loadLegacy', () => {
  it("fetches the selected file and en-gb from the installation's /lang/", async () => {
    const urls: string[] = []
    server.events.on('request:start', ({ request }) => {
      urls.push(new URL(request.url).pathname)
    })
    await loadLegacy('cs-cz')
    server.events.removeAllListeners()
    expect(urls).toEqual(expect.arrayContaining(['/lang/lang.en-gb.json', '/lang/lang.cs-cz.json']))
    expect(lt('login.login_admin')).toBe('Přihlášení správce')
    expect(legacyStatus.value).toEqual({ locale: 'cs-cz', base: 'installation', selected: true })
  })

  it('falls back to en-gb for a key the selected file lacks', async () => {
    // The upstream sk-sk file has no login.login_user (fixture copy of 2026-09a).
    await loadLegacy('sk-sk')
    expect(lt('login.login_user')).toBe('User Login')
    expect(lt('login.password')).toBe('Heslo')
  })

  it('shows the values verbatim, glyphs and markup included', async () => {
    await loadLegacy('en-gb')
    expect(lt('login.forgot_password')).toBe('> Forgot Password?')
    expect(lt('footer.restart_container_info')).toBe(
      '<b>Important:</b> A graceful restart may take a while to complete, please wait for it to finish.',
    )
  })

  it('formats placeholders', async () => {
    await loadLegacy('en-gb')
    expect(lt('login.delayed', 30)).toBe('Login was delayed by 30 seconds.')
    expect(lt('datatables.info', { _START_: 1, _END_: 25, _TOTAL_: 30 })).toBe(
      'Showing 1 to 25 of 30 entries',
    )
  })

  it("uses the installation's text over the snapshot, such as a fork's wording", async () => {
    server.use(
      http.get('*/lang/lang.en-gb.json', () =>
        HttpResponse.json({ login: { back_to_mailcow: 'Back to FeldHost™ Mailhosting' } }),
      ),
    )
    await loadLegacy('en-gb')
    expect(lt('login.back_to_mailcow')).toBe('Back to FeldHost™ Mailhosting')
  })

  it('uses en-gb alone when the selected file cannot be loaded', async () => {
    server.use(http.get('*/lang/lang.de-de.json', () => new HttpResponse(null, { status: 404 })))
    await loadLegacy('de-de')
    expect(lt('login.login')).toBe('Login')
    expect(legacyStatus.value).toEqual({ locale: 'de-de', base: 'installation', selected: false })
  })

  it('falls back to the bundled snapshot when en-gb cannot be loaded', async () => {
    server.use(http.get('*/lang/lang.en-gb.json', () => HttpResponse.error()))
    await loadLegacy('cs-cz')
    expect(lt('login.login_admin')).toBe('Přihlášení správce')
    expect(lt('login.email')).toBe('Mailová adresa')
    expect(legacyStatus.value.base).toBe('snapshot')
  })

  it('treats a file that is not a translation object as unavailable', async () => {
    server.use(http.get('*/lang/lang.en-gb.json', () => HttpResponse.text('<html>502</html>')))
    await loadLegacy('en-gb')
    expect(lt('login.login')).toBe('Login')
    expect(legacyStatus.value.base).toBe('snapshot')
  })

  it('completes a key the installation lacks from the snapshot', async () => {
    server.use(
      http.get('*/lang/lang.en-gb.json', () => HttpResponse.json({ login: { login: 'Sign on' } })),
    )
    await loadLegacy('en-gb')
    expect(lt('login.login')).toBe('Sign on')
    // The first read of a missing key loads the snapshot; the value follows reactively.
    const scope = effectScope()
    const seen: string[] = []
    scope.run(() => watchEffect(() => seen.push(lt('login.password'))))
    await vi.waitFor(() => expect(seen.at(-1)).toBe('Password'))
    scope.stop()
  })

  it('applies the last requested language when switches overlap', async () => {
    const first = loadLegacy('cs-cz')
    const second = loadLegacy('sk-sk')
    await Promise.all([first, second])
    expect(legacyStatus.value.locale).toBe('sk-sk')
    expect(lt('login.password')).toBe('Heslo')
  })

  it('fetches each file once, and again after a failure', async () => {
    let calls = 0
    server.use(
      http.get('*/lang/lang.de-de.json', () => {
        calls += 1
        return calls === 1
          ? HttpResponse.error()
          : HttpResponse.json({ login: { login: 'Anmelden' } })
      }),
    )
    prefetchLegacy('de-de')
    await loadLegacy('de-de')
    expect(lt('login.login')).toBe('Login')
    await loadLegacy('de-de')
    await loadLegacy('de-de')
    expect(lt('login.login')).toBe('Anmelden')
    expect(calls).toBe(2)
  })

  it('knows which keys exist', async () => {
    await loadLegacy('en-gb')
    expect(hasLegacy('login.login')).toBe(true)
    expect(hasLegacy('login.nothing_like_this')).toBe(false)
  })
})
