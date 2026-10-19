// The legacy fields of the mailbox forms (UI 003 T036–T040 under the forms rule): the quota in MiB
// with "max." and "0 = ∞", the password with its repeat, check and policy, the multi-selects locked
// by flags with "Prohibited by ACL", the radio groups, the encryption policy, the status select and
// the display components of the list and the usage figures.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import InUseBar from '@/features/mailboxes/components/display/InUseBar.vue'
import LastLogins from '@/features/mailboxes/components/display/LastLogins.vue'
import MailboxStatusBadge from '@/features/mailboxes/components/display/MailboxStatusBadge.vue'
import QuotaText from '@/features/mailboxes/components/display/QuotaText.vue'
import AuthSourceSelect from '@/features/mailboxes/components/fields/AuthSourceSelect.vue'
import LegacyCheckbox from '@/features/mailboxes/components/fields/LegacyCheckbox.vue'
import LegacyRadioGroup from '@/features/mailboxes/components/fields/LegacyRadioGroup.vue'
import MailboxQuotaField from '@/features/mailboxes/components/fields/MailboxQuotaField.vue'
import MultiSelectField from '@/features/mailboxes/components/fields/MultiSelectField.vue'
import { TAGGED_MAIL_OPTIONS } from '@/features/mailboxes/components/fields/options'
import PasswordFields from '@/features/mailboxes/components/fields/PasswordFields.vue'
import StatusSelect from '@/features/mailboxes/components/fields/StatusSelect.vue'
import TlsPolicyField from '@/features/mailboxes/components/fields/TlsPolicyField.vue'

import { mountWithApp } from '../../../support/mount'

const MIB = 1_048_576

describe('MailboxQuotaField', () => {
  it('shows legacy’s "max." badge, "0 = ∞" and emits the MiB typed', async () => {
    const wrapper = mountWithApp(MailboxQuotaField, {
      props: { id: 'q', labelKey: 'add.quota_mb', modelValue: '1024', max: 5120 * MIB },
    })
    expect(wrapper.text()).toContain('Quota (MiB)')
    expect(wrapper.text()).toContain('max. 5,120 MiB')
    expect(wrapper.text()).toContain('0 = ∞')
    await wrapper.get('input').setValue('2048')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['2048'])
  })

  it('waits for a domain, and shows legacy’s warning when the domain has no quota left', () => {
    const waiting = mountWithApp(MailboxQuotaField, {
      props: { id: 'q', labelKey: 'add.quota_mb', modelValue: '0', awaitingDomain: true },
    })
    expect(waiting.get('input').attributes('placeholder')).toBe('Please select a domain first')
    expect(waiting.get('input').attributes('disabled')).toBeDefined()
    const exhausted = mountWithApp(MailboxQuotaField, {
      props: { id: 'q', labelKey: 'add.quota_mb', modelValue: '0', max: 0, exhausted: true },
    })
    expect(exhausted.get('[data-quota-exhausted]').text()).toBe(
      'Domain quota exceeded: Only unlimited mailboxes can be created in this domain scope.',
    )
  })
})

describe('PasswordFields', () => {
  it('lists the policy as legacy does and "generate" fills both fields with a visible password', async () => {
    const wrapper = mountWithApp(PasswordFields, {
      props: {
        idPrefix: 'p',
        mode: 'add',
        password: '',
        password2: '',
        policy: {
          minLength: 10,
          requireLetters: false,
          requireDigits: true,
          requireSpecialCharacters: false,
          requireMixedCase: false,
        },
      },
    })
    expect(wrapper.get('[data-password-policy]').text()).toContain('Minimum password length is 10')
    expect(wrapper.get('[data-password-policy]').text()).toContain(
      'Must contain at least one number',
    )
    expect(wrapper.text()).toContain('Confirmation password (repeat)')
    expect(wrapper.text()).toContain('Check against haveibeenpwned.com')
    await wrapper.get('[data-generate]').trigger('click')
    const [password] = wrapper.emitted('update:password')!.at(-1) as [string]
    expect(wrapper.emitted('update:password2')!.at(-1)).toEqual([password])
    expect(password.length).toBe(16)
    expect(wrapper.get('#p-password').attributes('type')).toBe('text')
  })

  it('says "If unchanged leave blank" on the edit form and lists no rules without a policy', () => {
    const wrapper = mountWithApp(PasswordFields, {
      props: { idPrefix: 'p', mode: 'edit', password: '', password2: '', policy: null },
    })
    expect(wrapper.get('#p-password').attributes('placeholder')).toBe('If unchanged leave blank')
    expect(wrapper.find('[data-password-policy]').exists()).toBe(false)
  })
})

describe('multi-selects, radios, toggles, checkboxes and the status', () => {
  const options = [
    { value: 'imap', label: 'IMAP' },
    { value: 'pop3', label: 'POP3' },
  ]

  it('chooses several options, or lists them with "Prohibited by ACL" when locked', async () => {
    const wrapper = mountWithApp(MultiSelectField, {
      props: { id: 'm', label: 'Allowed', options, modelValue: ['imap'] },
    })
    const select = wrapper.get('select').element as HTMLSelectElement
    select.options[1]!.selected = true
    await wrapper.get('select').trigger('change')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['imap', 'pop3']])
    const locked = mountWithApp(MultiSelectField, {
      props: {
        id: 'm',
        label: 'Allowed',
        options,
        modelValue: ['imap'],
        lockedBy: 'protocolAccess',
      },
    })
    expect(locked.find('select').exists()).toBe(false)
    expect(locked.text()).toContain('IMAP')
    expect(locked.text()).toContain('Prohibited by ACL')
    expect(locked.text()).toContain('Change protocol access')
  })

  it('offers legacy’s radio options with their help, or shows the choice read-only', async () => {
    const wrapper = mountWithApp(LegacyRadioGroup, {
      props: {
        idPrefix: 'r',
        legendKey: 'user.tag_handling',
        modelValue: 'none',
        options: TAGGED_MAIL_OPTIONS,
        helpKeys: ['user.tag_help_explain'],
      },
    })
    expect(wrapper.text()).toContain('Set handling for tagged mail')
    expect(wrapper.text()).toContain('In subfolder')
    await wrapper.get('#r-subject').trigger('change')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['subject'])
    const readonly = mountWithApp(LegacyRadioGroup, {
      props: {
        idPrefix: 'r',
        legendKey: 'user.tag_handling',
        modelValue: 'subject',
        options: TAGGED_MAIL_OPTIONS,
        readonly: true,
      },
    })
    expect(readonly.find('input').exists()).toBe(false)
    expect(readonly.get('[data-value="r"]').text()).toBe('In subject')
  })

  it('toggles the encryption policy and shows it read-only', async () => {
    const wrapper = mountWithApp(TlsPolicyField, {
      props: { idPrefix: 't', inbound: false, outbound: true },
    })
    await wrapper.get('#t-inbound').setValue(true)
    expect(wrapper.emitted('update:inbound')?.at(-1)).toEqual([true])
    const readonly = mountWithApp(TlsPolicyField, {
      props: { idPrefix: 't', inbound: false, outbound: true, readonly: true },
    })
    expect(readonly.get('[data-value="t"]').text()).toBe('Enforce TLS outgoing')
  })

  it('labels the status select for assistive technology and uses the add or edit texts', async () => {
    const wrapper = mountWithApp(StatusSelect, {
      props: { id: 's', modelValue: 'active', keys: 'add' },
    })
    expect(wrapper.get('label').text()).toBe('Status')
    expect(wrapper.findAll('option').map((option) => option.text())).toEqual([
      'Active',
      'Disallow login (incoming mail is still accepted)',
      'Inactive',
    ])
    await wrapper.get('select').setValue('inactive')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['inactive'])
  })

  it('shows a checkbox with its legacy help, locked with the permission', () => {
    const wrapper = mountWithApp(LegacyCheckbox, {
      props: {
        id: 'c',
        labelKey: 'edit.force_pw_update',
        helpKey: 'edit.force_pw_update_info',
        helpArgs: ['Example Mail'],
        modelValue: false,
        lockedBy: 'sogoAccess',
      },
    })
    expect(wrapper.text()).toContain('This user will only be able to login to Example Mail.')
    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Allow management of SOGo access')
  })

  it('offers the built-in source by the product name, the allowed sources and the current one', async () => {
    const wrapper = mountWithApp(AuthSourceSelect, {
      props: {
        id: 'a',
        modelValue: 'ldap',
        capabilities: { authSources: ['mailcow'] },
        current: 'ldap',
      },
    })
    await flushPromises()
    const values = wrapper.findAll('option').map((option) => option.attributes('value'))
    expect(values).toEqual(['mailcow', 'ldap'])
    expect(wrapper.findAll('option')[1]!.text()).toBe('LDAP')
  })
})

describe('display', () => {
  it.each([
    [50, 'success', '50%'],
    [75, 'warning', '75%'],
    [92, 'danger', '92%'],
    [null, 'none', '-'],
  ] as const)('shows %s %% in legacy’s %s class', (percent, level, label) => {
    const wrapper = mountWithApp(InUseBar, { props: { percent } })
    expect(wrapper.get('[data-in-use]').attributes('data-in-use')).toBe(level)
    expect(wrapper.text()).toBe(label)
  })

  it('shows the quota as used/total with ∞ for unlimited, and the statuses with legacy texts', () => {
    expect(mountWithApp(QuotaText, { props: { used: 512 * MIB, quota: 0 } }).text()).toBe(
      '512 MiB/∞',
    )
    expect(
      mountWithApp(MailboxStatusBadge, { props: { status: 'loginDisabled' } }).text(),
    ).toContain('Disallow login (incoming mail is still accepted)')
  })

  it('lists the last logins of the allowed protocols and SSO, "No record" when missing', () => {
    const wrapper = mountWithApp(LastLogins, {
      props: {
        logins: { imap: '2026-10-17T08:00:00Z', pop3: null, smtp: null, webmailSso: null },
        access: { imap: true, pop3: false, smtp: true, sieve: true, activeSync: true, dav: true },
      },
    })
    const lines = wrapper.findAll('li').map((line) => line.text())
    expect(lines).toHaveLength(3)
    expect(lines[0]).toMatch(/^IMAP @ /)
    expect(lines[1]).toBe('SMTP @ No record')
    expect(lines[2]).toBe('SSO @ No record')
  })
})
