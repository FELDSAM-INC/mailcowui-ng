// UI 004 T109 (SC-007): every control of spec FR-002 is present exactly when permitted, for the
// administrator, the domain administrator without flags, with all flags, and with each single flag.
// Hiding is a convenience; the API enforces every permission.
import { DOMAIN_ADMIN_004 } from '../../mocks/scenarios/feature-004-base'
import { expect, test } from '../fixtures/test'
import { listReady } from '../aliases/helpers'

type Flag = 'aliasDomains' | 'aliasExternalGoto' | 'extendSenderAcl' | 'ratelimit'
const FLAGS: Flag[] = ['aliasDomains', 'aliasExternalGoto', 'extendSenderAcl', 'ratelimit']

interface Who {
  name: string
  scenario: string
  admin: boolean
  flags: readonly Flag[]
}

const WHO: Who[] = [
  { name: 'the administrator', scenario: 'admin-004', admin: true, flags: FLAGS },
  {
    name: 'a domain administrator without flags',
    scenario: 'domain-admin-004',
    admin: false,
    flags: [],
  },
  {
    name: 'a domain administrator with all flags',
    scenario: 'domain-admin-004-all-flags',
    admin: false,
    flags: FLAGS,
  },
  ...FLAGS.map((flag) => ({
    name: `a domain administrator with only ${flag}`,
    scenario: 'domain-admin-004',
    admin: false,
    flags: [flag] as const,
  })),
]

for (const who of WHO) {
  test(`SC-007 FR-002 the controls of ${who.name}`, async ({ page, mockApi }) => {
    // Five screens per identity.
    test.slow()
    await mockApi.use(who.scenario)
    if (!who.admin && who.flags.length === 1) {
      await mockApi.patch({
        flags: {
          [DOMAIN_ADMIN_004]: Object.fromEntries(
            FLAGS.map((flag) => [flag, who.flags.includes(flag)]),
          ),
        },
      })
    }
    const has = (flag: Flag) => who.admin || who.flags.includes(flag)

    // Aliases: everyone may add; orphaned aliases and History are for administrators.
    await page.goto('aliases')
    await listReady(page)
    await expect(page.getByRole('link', { name: 'Add alias' }).first()).toBeVisible()
    await expect(page.getByText('Orphaned')).toHaveCount(who.admin ? 1 : 0)
    await page.goto('aliases/new')
    await expect(page.locator('[data-external-notice]')).toHaveCount(
      has('aliasExternalGoto') ? 0 : 1,
    )
    await page.goto('aliases/1')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit alias' })).toBeVisible()
    await expect(page.getByRole('link', { name: /^History/ })).toHaveCount(who.admin ? 1 : 0)

    // Domain aliases: adding needs aliasDomains; the initial rate limit needs ratelimit.
    await page.goto('alias-domains')
    await listReady(page)
    await expect(page.getByRole('link', { name: 'Add domain alias' })).toHaveCount(
      has('aliasDomains') ? 1 : 0,
    )
    await page.goto('alias-domains/-/new')
    if (has('aliasDomains')) {
      await expect(page.getByRole('textbox', { name: 'Alias domain', exact: true })).toBeVisible()
      await expect(page.getByRole('group', { name: 'Rate limit' })).toHaveCount(
        has('ratelimit') ? 1 : 0,
      )
    } else {
      await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
    }

    // Resources: everyone may add.
    await page.goto('resources')
    await listReady(page)
    await expect(page.getByRole('link', { name: 'Add resource' }).first()).toBeVisible()
  })
}

test('SC-007 FR-051 FR-052 "*" for administrators only; external sender addresses only with extendSenderAcl', async ({
  page,
  mockApi,
}) => {
  for (const [scenario, admin, extend] of [
    ['sender-settings', true, true],
    ['sender-settings-da', false, false],
    ['sender-settings-da-extend', false, true],
  ] as const) {
    await mockApi.use(scenario)
    await page.goto('mailboxes/anna@example.org?edit=mailbox')
    await expect(page.locator('[data-sender-acl]')).toBeVisible()
    await expect(page.getByLabel('External sender addresses')).toHaveCount(extend ? 1 : 0)
    const picker = page.getByRole('combobox', { name: 'Allow to send as', exact: true })
    await picker.click()
    await picker.fill('*')
    const any = page.getByRole('listbox', { name: 'Allow to send as' }).getByRole('option', {
      name: /domain \* /,
    })
    if (admin) await expect(any).toBeVisible()
    else await expect(any).toHaveCount(0)
  }
})
