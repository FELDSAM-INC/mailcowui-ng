import { expect, test } from '../../fixtures/test'

test('FR-007 settings search links to the matched field section and Back preserves the query', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await mockApi.use('password-reset-available')
  await page.goto('system')
  const search = page.getByRole('searchbox', { name: 'Search settings' })
  await expect(search).toBeVisible()
  const inputToFrameMs = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const input = document.getElementById('settings-search') as HTMLInputElement
        const overview = document.querySelector('[data-settings-overview]')!
        const observer = new MutationObserver(() => {
          if (overview.querySelectorAll('[data-settings-results] a').length !== 1) return
          observer.disconnect()
          clearTimeout(timer)
          requestAnimationFrame(() => resolve(performance.now() - started))
        })
        const timer = setTimeout(() => {
          observer.disconnect()
          reject(new Error('Search did not render'))
        }, 3000)
        observer.observe(overview, { childList: true, subtree: true })
        input.focus()
        const started = performance.now()
        input.value = 'password sender'
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }),
  )
  expect(inputToFrameMs).toBeLessThan(300)
  await test.info().attach('settings-search-timing.json', {
    body: JSON.stringify({ inputToFrameMs }),
    contentType: 'application/json',
  })
  await expect(page).toHaveURL(/system\?q=password\+sender$/)
  await expect(search).toBeFocused()
  await expect(page.locator('[data-settings-results] a')).toHaveCount(1)
  await expect(page.locator('[data-settings-search-count]')).toHaveText('1 matching page')
  for (const operation of [
    'getPasswordPolicy',
    'getPasswordResetNotification',
    'getUiTexts',
    'getAppLinks',
  ])
    expect(await mockApi.countRequests(operation)).toBe(0)
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
  await page.locator('[data-settings-results] a').click()
  await expect(page).toHaveURL(/password-policy#password-reset-email$/)
  await expect(
    page.locator('#password-reset-email').getByRole('heading', { level: 2 }),
  ).toBeFocused()
  await page.goBack()
  await expect(search).toHaveValue('password sender')
  await expect(page.locator('[data-settings-results] a')).toHaveCount(1)
})

test('FR-007 no-result and capability changes preserve a usable search; stored values never match', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('settings-license-disabled')
  await page.goto('system?q=license')
  const search = page.getByRole('searchbox', { name: 'Search settings' })
  await expect(page.locator('[data-settings-search-empty]')).toContainText('No matching settings')
  await search.fill('mail.example.org')
  await expect(page).toHaveURL(/q=mail\.example\.org$/)
  await expect(page.locator('[data-settings-results] a')).toHaveCount(0)
  await page
    .locator('[data-settings-search-empty]')
    .getByRole('button', { name: 'Clear search' })
    .click()
  await expect(search).toBeFocused()
  await expect(search).toHaveValue('')
  await expect(page).toHaveURL(/\/system$/)
  await expectAccessible()
  await expectNoHorizontalScroll()
})

test('FR-008 English legacy names work in Czech and field results lead to Customize sections', async ({
  page,
  mockApi,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('ui-texts-custom', {
    accounts: {
      admin: { preferences: { language: 'cs-cz', theme: 'dark', etag: '"pref-search"' } },
    },
  })
  await page.goto('system?q=Customize')
  const results = page.locator('[data-settings-results] a')
  await expect(results).toHaveCount(5)
  const search = page.getByRole('searchbox', { name: 'Search settings' })
  await search.fill('System mails')
  await expect(results).toHaveCount(2)
  await search.fill('oznameni')
  await expect(results).toHaveCount(1)
  await results.click()
  await expect(page).toHaveURL(/customize\/ui-texts#section-announcement$/)
  await expect(page.locator('#section-announcement h2')).toBeFocused()
  await expectNoHorizontalScroll()
})
