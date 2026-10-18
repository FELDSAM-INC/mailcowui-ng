// UI 012 US1 smoke test (T028, research R25), against the API dev stack with its `idp` profile
// (`SMOKE_IDP=1 scripts/smoke/stack-up.sh`): an administrator sets up the dev OpenLDAP in the
// classic form, a wrong bind password fails the connection test, the right one passes, and the
// saved configuration shows the bind password only as stored.
import { expect, test } from '@playwright/test'

import { signIn } from './fixtures/domains-api'
import {
  DEV_LDAP,
  ensureMailboxTemplate,
  idpEnabled,
  removeIdentityProvider,
} from './fixtures/identity-provider'

test.describe('@idp identity provider', () => {
  test.skip(!idpEnabled(), 'needs SMOKE_IDP=1 (the API dev stack with the idp profile)')

  for (const viewport of [null, { width: 360, height: 780 }]) {
    test(`admin sets up LDAP, tests it and saves${viewport ? ' at 360 px' : ''}`, async ({
      page,
    }) => {
      if (viewport) await page.setViewportSize(viewport)
      await signIn(page, 'admin')
      await ensureMailboxTemplate(page, 'Staff')
      await removeIdentityProvider(page)
      try {
        await page.goto('identity-providers/provider')
        await page.locator('#idp-type').selectOption({ label: 'LDAP' })
        await page.locator('#idp-hosts').fill(DEV_LDAP.host)
        await page.locator('#idp-baseDn').fill(DEV_LDAP.baseDn)
        await page.locator('#idp-attributeField').fill('title')
        await page.locator('#idp-bindDn').fill(DEV_LDAP.bindDn)
        await page.getByRole('button', { name: 'Add: Attribute Mapping' }).click()
        await page.locator('#idp-attributeMapping-0-attributeValue').fill('staff')
        await page.locator('#idp-attributeMapping-0-template').selectOption('Staff')
        await page.locator('#idp-bindPassword').fill('wrong-password')
        await page.getByRole('button', { name: 'Test Connection' }).click()
        await expect(page.locator('[data-test-result]')).toContainText(
          'The provider rejected the credentials.',
          { timeout: 20_000 },
        )
        await page.locator('#idp-bindPassword').fill(DEV_LDAP.bindPassword)
        await page.getByRole('button', { name: 'Test Connection' }).click()
        await expect(page.locator('[data-test-result]')).toContainText('Connection successful', {
          timeout: 20_000,
        })
        await page.getByRole('button', { name: 'Save changes', exact: true }).click()
        await expect(page.locator('[data-page-status]')).toContainText(/have been saved/)
        await expect(page.locator('[data-value="bindPassword"]')).toContainText('Stored')
        await expect(page.locator('#section-provider')).not.toContainText(DEV_LDAP.bindPassword)
      } finally {
        await removeIdentityProvider(page)
      }
    })
  }
})
