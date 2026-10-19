// UI 008 US2 creating a sync job (T041): the classic add form in its order with the capabilities'
// defaults and ranges, the owner per role, the port rule, the protected password, client checks,
// server errors on their fields, an existing job, success, the custom-parameter restriction, the
// leave guard and the mobile keyboard attributes.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { isNarrow, listReady, requestsOf } from './helpers'

const field = (page: Page, name: string) => page.locator(`#syncjob-create-${name}`)

async function fillRequired(page: Page, host = 'imap.new.example', user = 'remote.user') {
  await field(page, 'remoteHost').fill(host)
  await field(page, 'remoteUser').fill(user)
  await field(page, 'remotePassword').fill('Remote-Secret-1')
}

async function pickOwner(page: Page, search: string, address: string) {
  const picker = field(page, 'mailbox')
  await picker.fill(search)
  await page.getByRole('option', { name: new RegExp(address) }).click()
}

test.describe('creating a sync job', () => {
  test('FR-048 "Create new sync job" is in the list header, reachable at 360 px, and in the empty state', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs')
    const create = page.getByRole('link', { name: 'Create new sync job' })
    await expect(create).toBeInViewport()
    await create.click()
    await expect(page).toHaveURL(/\/sync-jobs\/new$/)
    await mockApi.use('sync-jobs-empty')
    await page.goto('sync-jobs')
    await expect(
      page.locator('[data-list-state="empty"]').getByRole('link', { name: 'Create new sync job' }),
    ).toBeVisible()
  })

  test('US2-AS1 US2-AS2 FR-018 the classic add form in order with the defaults and ranges', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs/new')
    await expect(page.getByRole('heading', { level: 1, name: 'Add sync job' })).toBeVisible()
    await expect(page.getByText('Be aware that passwords need to be saved plain-text!')).toBeVisible()
    const ids = await page
      .locator('form [id^="syncjob-create-"]:is(input, select)')
      .evaluateAll((items) => items.map((item) => item.id.replace('syncjob-create-', '')))
    expect(ids).toEqual([
      'mailbox',
      'remoteHost',
      'remotePort',
      'remoteUser',
      'remotePassword',
      'encryption',
      'intervalMinutes',
      'destinationSubfolder',
      'maxAgeDays',
      'maxBytesPerSecond',
      'remoteTimeoutSeconds',
      'localTimeoutSeconds',
      'exclude',
      'customParameters',
      'deleteDuplicatesOnDestination',
      'deleteFromSource',
      'deleteFromDestination',
      'automap',
      'skipCrossDuplicates',
      'subscribeAll',
      'dryRun',
      'active',
    ])
    await expect(field(page, 'remotePort')).toHaveValue('993')
    await expect(field(page, 'encryption')).toHaveValue('ssl')
    await expect(field(page, 'intervalMinutes')).toHaveValue('20')
    await expect(field(page, 'exclude')).toHaveValue('(?i)spam|(?i)junk')
    await expect(field(page, 'remoteTimeoutSeconds')).toHaveValue('600')
    await expect(field(page, 'deleteDuplicatesOnDestination')).toBeChecked()
    await expect(field(page, 'automap')).toBeChecked()
    await expect(field(page, 'subscribeAll')).toBeChecked()
    await expect(field(page, 'dryRun')).not.toBeChecked()
    await expect(field(page, 'active')).toBeChecked()
    for (const range of ['1-65535', '1-43800', '0-32000', '0-125000000']) {
      await expect(page.getByText(range, { exact: true }).first()).toBeVisible()
    }
    await expect(page.getByText('Right: --param=xy, wrong: --param xy')).toBeVisible()
    await expect(page.getByText('(--delete2duplicates)')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add' })).toBeVisible()
    await expectAccessible()
    await expectNoHorizontalScroll()
    if (isNarrow(page)) await expectTouchTargets()
  })

  test('FR-055 a server with other defaults and limits gets them in the form and the hints', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin', {
      syncJobs: {
        capabilities: {
          defaults: { intervalMinutes: 45, encryption: 'starttls', dryRun: true },
          limits: { intervalMinutes: { minimum: 5, maximum: 600 } },
        },
      },
    })
    await page.goto('sync-jobs/new')
    await expect(field(page, 'intervalMinutes')).toHaveValue('45')
    await expect(field(page, 'remotePort')).toHaveValue('143')
    await expect(field(page, 'dryRun')).toBeChecked()
    await expect(page.getByText('5-600', { exact: true })).toBeVisible()
  })

  test('FR-019 the port follows the encryption until typed into', async ({ page, mockApi }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs/new')
    await field(page, 'encryption').selectOption('starttls')
    await expect(field(page, 'remotePort')).toHaveValue('143')
    await field(page, 'encryption').selectOption('plain')
    await expect(field(page, 'remotePort')).toHaveValue('143')
    await field(page, 'encryption').selectOption('ssl')
    await expect(field(page, 'remotePort')).toHaveValue('993')
    await field(page, 'remotePort').fill('1993')
    await field(page, 'encryption').selectOption('starttls')
    await expect(field(page, 'remotePort')).toHaveValue('1993')
  })

  test('US2-AS3 a mailbox user has no owner choice and sends no mailbox', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-user')
    await page.goto('sync-jobs/new')
    await expect(field(page, 'mailbox')).toHaveCount(0)
    await expect(field(page, 'customParameters')).toHaveAttribute(
      'placeholder',
      '--delete2folders --otheroption',
    )
    await fillRequired(page)
    await page.getByRole('button', { name: 'Add' }).click()
    await expect(page).toHaveURL(/\/sync-jobs\/\d+$/)
    const [request] = await requestsOf(mockApi, 'createSyncJob')
    expect(request!.body).not.toHaveProperty('mailbox')
  })

  test('US2-AS4 FR-020 a domain administrator picks among the mailboxes of example.org by typing', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('sync-jobs-domain-admin')
    await page.goto('sync-jobs/new')
    await field(page, 'mailbox').fill('example')
    const options = page.getByRole('option')
    await expect(options.first()).toBeVisible()
    const names = await options.allTextContents()
    expect(names.some((name) => name.includes('room1@'))).toBe(false)
    expect(names.some((name) => name.includes('example.net'))).toBe(false)
    expect(names.some((name) => name.includes('dora@example.org'))).toBe(true)
    await expectAccessible()
    await page.goto('sync-jobs/new?mailbox=dora%40example.org')
    await expect(field(page, 'mailbox')).toHaveValue(/dora@example\.org/)
  })

  test('Edge: a domain administrator without mailboxes gets an empty picker', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-domain-admin-no-mailboxes')
    await page.goto('sync-jobs/new')
    await field(page, 'mailbox').fill('a')
    await expect(page.getByText('No matching records found')).toBeVisible()
  })

  test('US2-AS5 FR-031 FR-032 FR-049 the password is masked and protected; fields suit phones', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs/new')
    const password = field(page, 'remotePassword')
    await expect(password).toHaveAttribute('type', 'password')
    await expect(password).toHaveAttribute('autocomplete', 'new-password')
    for (const attribute of ['data-1p-ignore', 'data-bwignore']) {
      await expect(password).toHaveAttribute(attribute, '')
    }
    await expect(password).toHaveAttribute('data-lpignore', 'true')
    await expect(password).toHaveAttribute('data-form-type', 'other')
    const reveal = page.getByRole('button', { name: 'Toggle password visibility' })
    await expect(reveal).toHaveAttribute('aria-pressed', 'false')
    await reveal.click()
    await expect(reveal).toHaveAttribute('aria-pressed', 'true')
    await expect(password).toHaveAttribute('type', 'text')
    await expect(field(page, 'remoteUser')).toHaveAttribute('autocomplete', 'off')
    for (const name of ['remotePort', 'intervalMinutes', 'maxAgeDays']) {
      await expect(field(page, name)).toHaveAttribute('inputmode', 'numeric')
    }
    for (const name of ['remoteHost', 'remoteUser', 'exclude', 'customParameters']) {
      await expect(field(page, name)).toHaveAttribute('autocapitalize', 'none')
      await expect(field(page, name)).toHaveAttribute('autocorrect', 'off')
      await expect(field(page, name)).toHaveAttribute('spellcheck', 'false')
    }
  })

  test('FR-021 client checks block empty, too long and out-of-range values without a request', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs/new')
    await field(page, 'intervalMinutes').fill('0')
    await page.getByRole('button', { name: 'Add' }).click()
    await expect(page.locator('#syncjob-create-mailbox-error')).toContainText('No user defined')
    await expect(page.locator('#syncjob-create-remoteHost-error')).toContainText(
      'This field is required.',
    )
    await expect(page.locator('#syncjob-create-intervalMinutes-error')).toContainText(
      'Enter a value from 1 to 43,800.',
    )
    await expect(page.getByRole('heading', { name: 'Please correct the following' })).toBeFocused()
    expect(await requestsOf(mockApi, 'createSyncJob')).toEqual([])
  })

  test('US2-AS7 FR-022 SC-006 server errors appear on their fields, in English and Czech', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs/new?mailbox=room1%40example.org')
    await fillRequired(page, '2001:db8::1')
    await field(page, 'exclude').fill('(junk')
    await field(page, 'customParameters').fill('--maxsize 100 --showpasswords')
    await page.getByRole('button', { name: 'Add' }).click()
    await expect(page.locator('#syncjob-create-remoteHost-error')).toContainText(
      'Enter a host name or an IPv4 address.',
    )
    await expect(page.locator('#syncjob-create-exclude-error')).toContainText(
      'This is not a valid regular expression.',
    )
    const params = page.locator('#syncjob-create-customParameters-error')
    await expect(params).toContainText('Write “maxsize 100” as --option=value, without spaces.')
    await expect(params).toContainText('The option --showpasswords is not allowed on this server.')
    await expect(page.locator('#syncjob-create-mailbox-error')).toContainText(
      'This address is a resource and cannot receive synced mail.',
    )
    await expect(page.getByRole('heading', { name: 'Please correct the following' })).toBeFocused()

    await mockApi.use('sync-jobs-admin', {
      accounts: { admin: { preferences: { language: 'cs-cz', theme: 'system', etag: '"p"' } } },
    })
    await page.goto('sync-jobs/new?mailbox=dora%40example.org')
    await fillRequired(page, 'bad_host!.example')
    await page.getByRole('button', { name: 'Přidat' }).click()
    await expect(page.locator('#syncjob-create-remoteHost-error')).toContainText(
      'Zadejte název hostitele nebo adresu IPv4.',
    )
  })

  test('FR-022 a field error from an injected refusal shows on its field', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin', {
      failures: {
        createSyncJob: {
          status: 422,
          type: 'validation-failed',
          times: 1,
          errors: {
            remotePort: [{ code: 'outOfRange', message: 'x', params: { min: 1, max: 65535 } }],
            remoteUser: [{ code: 'tooLong', message: 'x', params: { max: 255 } }],
          },
        },
      },
    })
    await page.goto('sync-jobs/new?mailbox=dora%40example.org')
    await fillRequired(page)
    await page.getByRole('button', { name: 'Add' }).click()
    await expect(page.locator('#syncjob-create-remotePort-error')).toContainText(
      'Enter a value from 1 to 65,535.',
    )
    await expect(page.locator('#syncjob-create-remoteUser-error')).toContainText(
      'Enter at most 255 characters.',
    )
  })

  test('FR-056 custom parameters refused after the restriction is switched on, and hidden when restricted', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-user')
    await page.goto('sync-jobs/new')
    await fillRequired(page)
    await field(page, 'customParameters').fill('--maxsize=1')
    await mockApi.patch({
      syncJobs: { capabilities: { customParameters: { restrictedToAdministrators: true } } },
    })
    await page.getByRole('button', { name: 'Add' }).click()
    await expect(page.locator('#syncjob-create-customParameters-error')).toContainText(
      'Only administrators may set custom parameters on this server.',
    )
    await mockApi.use('sync-jobs-user-restricted-params')
    await page.goto('sync-jobs/new')
    await expect(field(page, 'customParameters')).toHaveCount(0)
    await fillRequired(page)
    await page.getByRole('button', { name: 'Add' }).click()
    await expect(page).toHaveURL(/\/sync-jobs\/\d+$/)
    const [request] = await requestsOf(mockApi, 'createSyncJob')
    expect(request!.body).not.toHaveProperty('customParameters')
  })

  test('US2-AS8 FR-023 an existing job keeps the values and links to it', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs/new?mailbox=alice%40example.org')
    await fillRequired(page, 'mail.previous.example', 'alice')
    await page.getByRole('button', { name: 'Add' }).click()
    await expect(page.getByText('Object mail.previous.example / alice already exists')).toBeVisible()
    await expect(field(page, 'remoteHost')).toHaveValue('mail.previous.example')
    await page.getByRole('link', { name: 'Open the existing job' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click()
    await expect(page).toHaveURL(/\/sync-jobs\/2$/)
  })

  test('US2-AS9 FR-028 success is shown, the new job opens and Back skips the form', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs')
    await listReady(page)
    await page.getByRole('link', { name: 'Create new sync job' }).click()
    await pickOwner(page, 'dora', 'dora@example.org')
    await fillRequired(page)
    await page.getByRole('button', { name: 'Add' }).click()
    await expect(page).toHaveURL(/\/sync-jobs\/61$/)
    await expect(
      page.locator('#section-syncjob').getByText('Changes to mailbox dora@example.org have been saved'),
    ).toBeVisible()
    await expect(page.locator('[data-live="polite"]')).toContainText('dora@example.org')
    await page.goBack()
    await expect(page).toHaveURL(/\/sync-jobs$/)
    await listReady(page)
    await expect(page.locator('[data-entry="61"]')).toBeVisible()
  })

  test('FR-027 leaving the form with input asks first', async ({ page, mockApi }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs')
    await page.getByRole('link', { name: 'Create new sync job' }).click()
    await field(page, 'remoteHost').fill('imap.leaving.example')
    await page.goBack()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Leave without saving?')
    await dialog.getByRole('button', { name: 'Stay' }).click()
    await expect(field(page, 'remoteHost')).toHaveValue('imap.leaving.example')
  })

  test('Edge: an ended session leads to sign-in and keeps no typed password', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs/new?mailbox=dora%40example.org')
    await fillRequired(page)
    await mockApi.patch({ expireSession: true })
    await page.getByRole('button', { name: 'Add' }).click()
    await expect(page).toHaveURL(/sign-in/)
    const stored = await page.evaluate(() =>
      JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), history.state]),
    )
    expect(stored).not.toContain('Remote-Secret-1')
  })
})
