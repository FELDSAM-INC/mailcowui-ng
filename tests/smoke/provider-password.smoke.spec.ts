// UI 012 US3 smoke test (T063, research R25), against the API dev stack with its `idp` profile
// (`SMOKE_IDP=1 scripts/smoke/stack-up.sh`): with the dev OpenLDAP stored as the identity provider
// (through the API, the fixture of T028), the LDAP mailbox carl@example.org signs in with his
// directory password through the app's password form, reaches home and signs out.
import { test } from '@playwright/test'

import { SMOKE_DEFAULT_PASSWORD } from './fixtures/accounts'
import { signIn as signInAs } from './fixtures/domains-api'
import { expectHome, signIn, signOut } from './fixtures/flows'
import { configureDevLdap, idpEnabled } from './fixtures/identity-provider'

const LDAP_USER = 'carl@example.org'

test.describe('@idp password sign-in through LDAP', () => {
  test.skip(!idpEnabled(), 'needs SMOKE_IDP=1 (the API dev stack with the idp profile)')

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await signInAs(page, 'admin')
    await configureDevLdap(page)
    await page.close()
  })

  test(`${LDAP_USER} signs in with the directory password and signs out`, async ({ page }) => {
    await signIn(page, LDAP_USER, SMOKE_DEFAULT_PASSWORD, 'sign-in/mailbox-user')
    await expectHome(page, LDAP_USER)
    await signOut(page)
  })
})
