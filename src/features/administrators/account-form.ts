import type { Admin, DomainAdmin } from '@/api'
import { legacy } from '@/i18n'
import { MAILBOX_PASSWORD_MAX } from '@/shared/validation/limits'
import type { ClientErrors } from '@/shared/validation/client-errors'
import type { AccountPatch, AccountRole } from './api'
import { normaliseUsername, validateUsername } from './username'

export interface AccountForm {
  username: string
  domains: string[]
  password: string
  password2: string
  active: boolean
  forcePasswordChange: boolean
  forceSecondFactorSetup: boolean
}
export function formFromAccount(item?: Admin | DomainAdmin): AccountForm {
  return {
    username: item?.username ?? '',
    domains:
      item && 'domains' in item
        ? item.domains.filter((domain) => domain.domainExists).map((domain) => domain.domain)
        : [],
    password: '',
    password2: '',
    active: item?.active ?? true,
    forcePasswordChange: item?.forcePasswordChange ?? false,
    forceSecondFactorSetup: item?.forceSecondFactorSetup ?? false,
  }
}
/** Passwords are deliberately absent. A save that includes one uses the direct secret request. */
export function changedAccountFields(item: Admin | DomainAdmin, form: AccountForm): AccountPatch {
  const patch: AccountPatch = {}
  const username = normaliseUsername(form.username)
  if (username !== item.username) patch.username = username
  for (const key of ['active', 'forcePasswordChange', 'forceSecondFactorSetup'] as const)
    if (form[key] !== item[key]) patch[key] = form[key]
  if ('domains' in item) {
    const previous = item.domains
      .filter((domain) => domain.domainExists)
      .map((domain) => domain.domain)
      .sort()
    if (JSON.stringify([...form.domains].sort()) !== JSON.stringify(previous))
      patch.domains = [...form.domains]
  }
  return patch
}
export function validateAccountForm(
  form: AccountForm,
  role: AccountRole,
  creating: boolean,
  max: number,
  original?: Admin | DomainAdmin,
): ClientErrors {
  const errors: ClientErrors = {}
  const invalid = validateUsername(form.username, max)
  if (invalid)
    errors.username = [
      {
        key:
          invalid.code === 'required'
            ? 'validation.required'
            : invalid.code === 'tooLong'
              ? 'validation.tooLong'
              : legacy('danger.username_invalid', form.username),
        params: invalid.code === 'tooLong' ? { max: String(max) } : undefined,
      },
    ]
  const hadDomains =
    !original || !('domains' in original) || original.domains.some((domain) => domain.domainExists)
  if (role === 'domainAdmin' && !form.domains.length && (creating || hadDomains))
    errors.domains = [{ key: legacy('danger.domain_invalid', '') }]
  if (creating && !form.password) errors.password = [{ key: 'validation.required' }]
  if (form.password.length > MAILBOX_PASSWORD_MAX)
    errors.password = [{ key: 'validation.tooLong', params: { max: String(MAILBOX_PASSWORD_MAX) } }]
  if (form.password !== form.password2)
    errors.password2 = [{ key: legacy('danger.password_mismatch') }]
  return errors
}
