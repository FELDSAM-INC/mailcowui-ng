<script setup lang="ts">
// The "Mailbox" tab of the classic mailbox page (`templates/edit/mailbox.twig` #medit) as one
// section with its own save (owner rule 1:1, legacy form map): the identity provider, full name,
// tags, quota in MiB with its "max." badge and "0 = ∞"; the sender-dependent transports, read-only
// until UI 009 (administrators and `mailboxRelayhost`); the tagged mail handling, quarantine
// notification and category and encryption policy, read-only until UI 005 and UI 006; for the
// built-in source the password with its repeat, check and policy, and the recovery e-mail; the
// allowed protocols; then the status, forced password change, forced 2FA enrollment and SOGo access
// with their legacy help, the save, and the creation and modification times. UI 004 adds "Allow to
// send as" and the external sender addresses in their legacy positions. Saving says legacy's
// `success.mailbox_modified`.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBranding } from '@/app/branding/public-config'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import EditableSection from '@/shared/components/EditableSection.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import TagSetInput from '@/shared/components/TagSetInput.vue'
import ValueList from '@/shared/components/ValueList.vue'
import type { ClientErrors } from '@/shared/validation/client-errors'

import { canSeeRelayhost, canSetUnlimited, gate } from '../../acl'
import { controlsFor } from '../../auth-source'
import { useMailboxSection, type MailboxSectionProps } from '../../composables/useMailboxSection'
import { useMailboxTagSuggestions } from '../../composables/useMailboxTagSuggestions'
import { usePasswordPolicy } from '../../composables/usePasswordPolicy'
import { useMailboxFieldDisplay } from '../../field-display'
import { mailboxPatch, type SectionField } from '../../patch'
import { checkQuota, quotaMib } from '../../quota'
import { PROTOCOL_ORDER, type Protocol } from '../../types'
import { checkDisplayName, checkPasswordPair, checkRecoveryEmail } from '../../validation'
import AuthSourceSelect from '../fields/AuthSourceSelect.vue'
import LegacyCheckbox from '../fields/LegacyCheckbox.vue'
import LegacyRadioGroup from '../fields/LegacyRadioGroup.vue'
import MailboxQuotaField from '../fields/MailboxQuotaField.vue'
import MultiSelectField from '../fields/MultiSelectField.vue'
import PasswordFields from '../fields/PasswordFields.vue'
import StatusSelect from '../fields/StatusSelect.vue'
import TlsPolicyField from '../fields/TlsPolicyField.vue'
import {
  protocolKey,
  QUARANTINE_CATEGORY_OPTIONS,
  QUARANTINE_NOTIFICATION_OPTIONS,
  TAGGED_MAIL_OPTIONS,
} from '../fields/options'

const props = withDefaults(defineProps<MailboxSectionProps>(), {
  editing: false,
  editDisabledReason: null,
  capabilities: undefined,
  identity: null,
})
const emit = defineEmits<{
  edit: []
  close: []
  dirty: [value: boolean]
  saved: [mailbox: MailboxSectionProps['mailbox']]
}>()
const { t } = useI18n()
const fmt = useFormat()
const display = useMailboxFieldDisplay()
const { branding } = useBranding()
const suggestions = useMailboxTagSuggestions()
const policyQuery = usePasswordPolicy()
const policy = computed(() => policyQuery.data.value ?? null)

const FIELDS: SectionField[] = [
  'authSource',
  'displayName',
  'tags',
  'quota',
  'password',
  'recoveryEmail',
  'protocolAccess',
  'status',
  'forcePasswordChange',
  'forceSecondFactorSetup',
  'webmailRedirect',
]

interface Form {
  authSource: MailboxSectionProps['mailbox']['authSource']
  displayName: string
  tags: string[]
  quota: string
  password: string
  password2: string
  recoveryEmail: string
  protocols: Protocol[]
  status: MailboxSectionProps['mailbox']['status']
  forcePasswordChange: boolean
  forceSecondFactorSetup: boolean
  webmailRedirect: boolean
}

const toForm = (mailbox: MailboxSectionProps['mailbox']): Form => ({
  authSource: mailbox.authSource,
  displayName: mailbox.displayName,
  tags: [...mailbox.tags],
  quota: quotaMib(mailbox.quota),
  password: '',
  password2: '',
  recoveryEmail: mailbox.recoveryEmail ?? '',
  protocols: PROTOCOL_ORDER.filter((protocol) => mailbox.protocolAccess[protocol]),
  status: mailbox.status,
  forcePasswordChange: mailbox.forcePasswordChange,
  forceSecondFactorSetup: mailbox.forceSecondFactorSetup,
  webmailRedirect: mailbox.webmailRedirect,
})

const protocolGate = computed(() => gate('protocolAccess', props.identity))
const sogoGate = computed(() => gate('webmailRedirect', props.identity))
const groupware = computed(() => props.capabilities?.groupwareEnabled !== false)

function quotaRules(base: MailboxSectionProps['mailbox']) {
  return {
    max: base.largestAllowedQuota,
    unlimitedAllowed: canSetUnlimited(props.identity, base.quota),
    current: base.quota,
  }
}

function validate(form: Form, base: MailboxSectionProps['mailbox']): ClientErrors {
  const errors: ClientErrors = {}
  checkDisplayName(errors, 'displayName', form.displayName)
  checkQuota(errors, 'quota', form.quota, quotaRules(base))
  if (controlsFor(form.authSource).password) {
    checkPasswordPair(errors, form.password, form.password2, { required: false })
    checkRecoveryEmail(errors, 'recoveryEmail', form.recoveryEmail)
  }
  return errors
}

const s = useMailboxSection<Form>(props, emit as never, {
  id: 'mailbox',
  fields: FIELDS,
  toForm,
  validate,
  fieldId: (path) => {
    const field = path.split('.')[0] ?? path
    if (field === 'protocolAccess') return 'section-mailbox-protocols'
    if (field === 'password2') return 'section-mailbox-password2'
    return `section-mailbox-${field}`
  },
  makePatch: (opened, form, canEdit) => {
    const builtIn = controlsFor(form.authSource).password
    const quota = checkQuota({}, 'quota', form.quota, quotaRules(opened)) ?? opened.quota
    return mailboxPatch(
      opened,
      {
        ...form,
        quota,
        password: builtIn ? form.password : '',
        recoveryEmail: builtIn ? form.recoveryEmail : (opened.recoveryEmail ?? ''),
      },
      (field) =>
        canEdit(field) &&
        (field !== 'protocolAccess' || protocolGate.value.state === 'editable') &&
        (field !== 'webmailRedirect' || (sogoGate.value.state === 'editable' && groupware.value)),
    )
  },
})

const controls = computed(() => controlsFor(s.form.value.authSource))
const readControls = computed(() => controlsFor(props.mailbox.authSource))
const relayhost = computed(() =>
  props.mailbox.relayhostId ? `ID ${props.mailbox.relayhostId}` : lt('edit.none_inherit'),
)
const optionLabel = (
  options: readonly { value: string; labelKey: Parameters<typeof lt>[0] }[],
  value: string,
) => {
  const option = options.find((item) => item.value === value)
  return option ? lt(option.labelKey) : value
}
const tlsLabel = computed(() =>
  fmt.list(
    [
      props.mailbox.tlsEnforceInbound ? lt('user.tls_enforce_in') : null,
      props.mailbox.tlsEnforceOutbound ? lt('user.tls_enforce_out') : null,
    ].filter((item): item is string => item !== null),
  ),
)
const protocolOptions = computed(() =>
  PROTOCOL_ORDER.map((protocol) => ({ value: protocol, label: t(protocolKey(protocol)) })),
)

const items = computed(() => [
  { key: 'authSource', label: lt('admin.iam'), value: display.source(props.mailbox.authSource) },
  { key: 'displayName', label: lt('edit.full_name'), value: props.mailbox.displayName },
  { key: 'tags', label: lt('add.tags'), value: display.value('tags', props.mailbox.tags) },
  { key: 'quota', label: lt('edit.quota_mb'), value: display.quota(props.mailbox.quota) },
  ...(canSeeRelayhost(props.identity)
    ? [{ key: 'relayhost', label: lt('edit.relayhost'), value: relayhost.value }]
    : []),
  {
    key: 'taggedMailHandling',
    label: lt('user.tag_handling'),
    value: optionLabel(TAGGED_MAIL_OPTIONS, props.mailbox.taggedMailHandling),
  },
  {
    key: 'quarantineNotification',
    label: lt('user.quarantine_notification'),
    value: optionLabel(QUARANTINE_NOTIFICATION_OPTIONS, props.mailbox.quarantineNotification),
  },
  {
    key: 'quarantineCategory',
    label: lt('user.quarantine_category'),
    value: optionLabel(QUARANTINE_CATEGORY_OPTIONS, props.mailbox.quarantineCategory),
  },
  { key: 'tls', label: lt('user.tls_policy'), value: tlsLabel.value },
  ...(readControls.value.recoveryEmail
    ? [
        {
          key: 'recoveryEmail',
          label: lt('edit.password_recovery_email'),
          value: display.value('recoveryEmail', props.mailbox.recoveryEmail),
        },
      ]
    : []),
  {
    key: 'protocolAccess',
    label: lt('edit.allowed_protocols'),
    value: display.value('protocolAccess', props.mailbox.protocolAccess),
  },
  {
    key: 'status',
    label: lt('mailbox.status'),
    value: display.value('status', props.mailbox.status),
  },
  {
    key: 'forcePasswordChange',
    label: lt('edit.force_pw_update'),
    value: display.yesNo(props.mailbox.forcePasswordChange),
  },
  {
    key: 'forceSecondFactorSetup',
    label: lt('tfa.force_tfa'),
    value: display.yesNo(props.mailbox.forceSecondFactorSetup),
  },
  ...(groupware.value
    ? [
        {
          key: 'webmailRedirect',
          label: lt('edit.sogo_access'),
          value: display.yesNo(props.mailbox.webmailRedirect),
        },
      ]
    : []),
])

const times = computed(() => [
  `${lt('edit.created_on')}: ${fmt.dateTime(props.mailbox.createdAt)}`,
  `${lt('edit.last_modified')}: ${props.mailbox.modifiedAt ? fmt.dateTime(props.mailbox.modifiedAt) : lt('user.never')}`,
])
</script>

<template>
  <EditableSection
    section-id="mailbox"
    :title="lt('edit.mailbox')"
    :editable="true"
    :editing="editing"
    :edit-disabled-reason="editDisabledReason"
    :saving="s.pending.value"
    :status="s.status.value"
    :outdated="s.outdated.value"
    :save-label="lt('edit.save')"
    @edit="emit('edit')"
    @cancel="s.cancel"
    @save="s.save"
    @save-again="s.saveAgain"
    @discard="s.discard"
  >
    <ValueList :items="items" />
    <p class="mt-3 text-sm text-gray-600 italic dark:text-gray-400">
      <span v-for="line in times" :key="line" class="block">{{ line }}</span>
    </p>
    <template #form>
      <ErrorSummary :id="s.problemForm.summaryId" :items="s.problemForm.summary.value" />
      <ProblemMessage :problem="s.problem.value" />
      <AuthSourceSelect
        id="section-mailbox-authSource"
        v-model="s.form.value.authSource"
        :capabilities="capabilities"
        :current="mailbox.authSource"
        :errors="s.errorsFor('authSource')"
      />
      <FormField
        id="section-mailbox-displayName"
        :label="lt('edit.full_name')"
        :errors="s.errorsFor('displayName')"
      >
        <template #default="control">
          <input
            v-bind="control"
            v-model="s.form.value.displayName"
            type="text"
            autocomplete="off"
            class="form-control"
          />
        </template>
      </FormField>
      <TagSetInput
        id="section-mailbox-tags"
        v-model="s.form.value.tags"
        :label="lt('add.tags')"
        :max-length="capabilities?.tagMaxLength ?? 255"
        :errors="s.errorsFor('tags')"
        :suggestions="suggestions.suggestions.value"
        :suggestions-state="suggestions.state.value"
        @search="suggestions.search"
      />
      <MailboxQuotaField
        id="section-mailbox-quota"
        v-model="s.form.value.quota"
        label-key="edit.quota_mb"
        :max="mailbox.largestAllowedQuota"
        :errors="s.errorsFor('quota')"
      />
      <ValueList
        v-if="canSeeRelayhost(identity)"
        :items="[{ key: 'relayhost', label: lt('edit.relayhost'), value: relayhost }]"
      />
      <LegacyRadioGroup
        id-prefix="section-mailbox-taggedMail"
        legend-key="user.tag_handling"
        :model-value="mailbox.taggedMailHandling"
        :options="TAGGED_MAIL_OPTIONS"
        :help-keys="['user.tag_help_explain', 'user.tag_help_example']"
        readonly
      />
      <LegacyRadioGroup
        id-prefix="section-mailbox-quarantineNotification"
        legend-key="user.quarantine_notification"
        :model-value="mailbox.quarantineNotification"
        :options="QUARANTINE_NOTIFICATION_OPTIONS"
        :help-keys="['user.quarantine_notification_info']"
        readonly
      />
      <LegacyRadioGroup
        id-prefix="section-mailbox-quarantineCategory"
        legend-key="user.quarantine_category"
        :model-value="mailbox.quarantineCategory"
        :options="QUARANTINE_CATEGORY_OPTIONS"
        :help-keys="['user.quarantine_category_info']"
        readonly
      />
      <TlsPolicyField
        id-prefix="section-mailbox-tls"
        :inbound="mailbox.tlsEnforceInbound"
        :outbound="mailbox.tlsEnforceOutbound"
        readonly
      />
      <template v-if="controls.password">
        <PasswordFields
          id-prefix="section-mailbox"
          mode="edit"
          :password="s.form.value.password"
          :password2="s.form.value.password2"
          :policy="policy"
          :errors="s.errorsFor('password')"
          :repeat-errors="s.errorsFor('password2')"
          @update:password="s.form.value.password = $event"
          @update:password2="s.form.value.password2 = $event"
        />
        <FormField
          id="section-mailbox-recoveryEmail"
          :label="lt('edit.password_recovery_email')"
          :errors="s.errorsFor('recoveryEmail')"
        >
          <template #default="control">
            <input
              v-bind="control"
              v-model="s.form.value.recoveryEmail"
              type="email"
              inputmode="email"
              autocomplete="off"
              class="form-control"
              :aria-describedby="
                [control['aria-describedby'], 'section-mailbox-recoveryEmail-help']
                  .filter(Boolean)
                  .join(' ')
              "
            />
          </template>
        </FormField>
        <LegacyText
          id="section-mailbox-recoveryEmail-help"
          k="admin.password_reset_info"
          as="p"
          class="-mt-2 text-sm text-gray-600 dark:text-gray-400"
        />
      </template>
      <MultiSelectField
        id="section-mailbox-protocols"
        :model-value="s.form.value.protocols"
        :label="lt('edit.allowed_protocols')"
        :options="protocolOptions"
        :errors="s.errorsFor('protocolAccess')"
        :locked-by="
          protocolGate.state === 'readOnly' || !s.canEdit('protocolAccess')
            ? 'protocolAccess'
            : null
        "
        @update:model-value="s.form.value.protocols = $event as Protocol[]"
      />
      <hr class="border-gray-200 dark:border-gray-800" />
      <StatusSelect id="section-mailbox-status" v-model="s.form.value.status" keys="edit" />
      <LegacyCheckbox
        id="section-mailbox-forcePasswordChange"
        v-model="s.form.value.forcePasswordChange"
        label-key="edit.force_pw_update"
        help-key="edit.force_pw_update_info"
        :help-args="[branding.productName]"
        :disabled="!controls.forcePasswordChange"
      />
      <LegacyCheckbox
        id="section-mailbox-forceSecondFactorSetup"
        v-model="s.form.value.forceSecondFactorSetup"
        label-key="tfa.force_tfa"
        help-key="tfa.force_tfa_info"
        :disabled="!controls.forceSecondFactorSetup"
      />
      <LegacyCheckbox
        v-if="groupware"
        id="section-mailbox-webmailRedirect"
        v-model="s.form.value.webmailRedirect"
        label-key="edit.sogo_access"
        help-key="edit.sogo_access_info"
        :locked-by="
          sogoGate.state === 'readOnly' || !s.canEdit('webmailRedirect') ? 'sogoAccess' : null
        "
      />
    </template>
  </EditableSection>
</template>
