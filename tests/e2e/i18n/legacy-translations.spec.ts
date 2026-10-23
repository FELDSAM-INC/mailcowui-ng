// mailcow's own translations, used one to one (constitution IV 1.3.0, research R15): the app reads
// the installation's `/lang/lang.<code>.json` at runtime, merges the selected language over en-gb
// as the classic interface does, falls back to its bundled snapshot when `/lang/` cannot be
// loaded, renders markup in legacy values through the sanitiser under the strict CSP, and offers
// the installation's language menu.
import { expect, test } from '../fixtures/test'
import { chooseAuthLanguage } from '../fixtures/flows'

test("the sign-in screen shows mailcow's Czech strings and the app's own Czech strings", async ({
  page,
  expectAccessible,
}) => {
  await page.goto('sign-in/admin')
  await chooseAuthLanguage(page, 'Čeština (Czech)')
  const main = page.getByRole('main')
  // lang.cs-cz.json (upstream 2026-09a fixture): login.login_admin, login.username, login.login.
  await expect(page.getByRole('heading', { level: 1, name: 'Přihlášení správce' })).toBeVisible()
  await expect(main.getByLabel('Uživatelské jméno', { exact: true })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Přihlásit', exact: true })).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Hledáte jinou přihlašovací stránku?' }),
  ).toBeVisible()
  // A new string, from the app's own cs-cz messages.
  await expect(main.getByRole('button', { name: 'Přepnout viditelnost hesla' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs-CZ')
  await expectAccessible()
})

test("a language without the installation's file shows en-gb, as the classic interface does", async ({
  page,
}) => {
  const requests: string[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (path.startsWith('/lang/')) requests.push(path)
  })
  await page.goto('sign-in')
  await chooseAuthLanguage(page, 'Deutsch (German)')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de-DE')
  // The mock has no lang.de-de.json: every key falls back to en-gb, new strings too.
  await expect(page.getByRole('heading', { level: 1, name: 'Login' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Toggle password visibility' })).toBeVisible()
  expect(requests).toEqual(
    expect.arrayContaining(['/lang/lang.en-gb.json', '/lang/lang.de-de.json']),
  )
})

test('a key the selected file lacks falls back to en-gb (the upstream sk-sk file has no login.login_user)', async ({
  page,
}) => {
  await page.goto('sign-in/mailbox-user')
  await chooseAuthLanguage(page, 'Slovenčina (Slovak)')
  await expect(page.locator('html')).toHaveAttribute('lang', 'sk-SK')
  await expect(page.getByRole('heading', { level: 1, name: 'User Login' })).toBeVisible()
  await expect(page.getByLabel('Heslo', { exact: true })).toBeVisible()
})

test("the installation's own wording wins over the snapshot, like a fork's", async ({
  page,
  mockApi,
}) => {
  await mockApi.use('anonymous-default', {
    behaviour: {
      langPatch: {
        'en-gb': { login: { login_linkstext: 'Not the correct FeldHost™ Mailhosting login?' } },
      },
    },
  })
  await page.goto('sign-in')
  await expect(
    page.getByRole('navigation', { name: 'Not the correct FeldHost™ Mailhosting login?' }),
  ).toBeVisible()
})

test('markup in a legacy value is rendered sanitised, without CSP violations', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('anonymous-default', {
    behaviour: {
      langPatch: {
        'en-gb': {
          login: {
            login_admin:
              'Administrator <b>Login</b><img src=x onerror="alert(1)"><span style="color:red">!</span>',
          },
        },
      },
    },
  })
  await page.goto('sign-in/admin')
  const heading = page.getByRole('heading', { level: 1 })
  await expect(heading).toHaveText('Administrator Login!')
  await expect(heading.locator('b')).toHaveText('Login')
  await expect(heading.locator('img, [style], [onerror]')).toHaveCount(0)
  await expectAccessible()
})

test("the bundled snapshot stands in when the installation's /lang/ cannot be loaded", async ({
  page,
  mockApi,
}) => {
  await mockApi.use('anonymous-default', { behaviour: { langUnavailable: true } })
  await page.goto('sign-in/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Administrator Login' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Log in as user' })).toBeVisible()
})

test("the language menu is the installation's, in its order and with its names", async ({
  page,
}) => {
  await page.goto('sign-in')
  await page.locator('[data-language-select]').click()
  const options = page.getByRole('menuitemradio')
  const names = ['Čeština (Czech)', 'Deutsch (German)', 'English', 'Slovenčina (Slovak)']
  await expect(options).toHaveCount(names.length)
  for (const [index, name] of names.entries())
    await expect(options.nth(index)).toHaveAccessibleName(name)
})
