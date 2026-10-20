import { expect, it } from 'vitest'
import {
  formFromAccount,
  changedAccountFields,
  validateAccountForm,
} from '@/features/administrators/account-form'
import { adminView, mockAdmin } from '../../../mocks/factories/admin'
import { domainAdminView, mockDomainAdmin } from '../../../mocks/factories/domain-admin'
it('starts with classic defaults, including empty password confirmation, and only sends changed metadata', () => {
  const defaults = formFromAccount()
  expect(defaults).toMatchObject({
    username: '',
    password: '',
    password2: '',
    active: true,
    domains: [],
  })
  const item = domainAdminView(mockDomainAdmin())
  const form = formFromAccount(item)
  expect(changedAccountFields(item, form)).toEqual({})
  expect(
    changedAccountFields(item, {
      ...form,
      username: ' Renamed ',
      active: false,
      password: 'never-cached',
      password2: 'never-cached',
    }),
  ).toEqual({ username: 'renamed', active: false })
})
it('requires matching passwords on create but sends no blank password on edit', () => {
  const form = {
    ...formFromAccount(),
    username: 'valid',
    domains: ['example.org'],
    password: 'abc',
    password2: 'other',
  }
  expect(validateAccountForm(form, 'domainAdmin', true, 255).password2).toBeDefined()
  expect(validateAccountForm({ ...form, password2: 'abc' }, 'domainAdmin', true, 255)).toEqual({})
  expect(validateAccountForm(formFromAccount(adminView(mockAdmin())), 'admin', false, 255)).toEqual(
    {},
  )
})
it('requires a domain for domain administrators and never edits legacy non-domain assignments', () => {
  const item = domainAdminView(
    mockDomainAdmin({
      domains: [
        {
          domain: 'ALL',
          domainUnicode: 'ALL',
          domainExists: false,
          active: true,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
    }),
  )
  const form = formFromAccount(item)
  expect(form.domains).toEqual([])
  expect(validateAccountForm(form, 'domainAdmin', false, 255).domains).toBeDefined()
})
