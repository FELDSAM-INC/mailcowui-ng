<script setup lang="ts">
// The mailbox values of the classic add mailbox and mailbox template forms (owner rule 1:1,
// #addMailboxTemplateModal and `edit/mailbox-templates.twig`), in legacy order after the name:
// tags, quota in MiB ("0 = ∞"), tagged mail handling, quarantine notification and category,
// encryption policy, allowed protocols, ACL, rate limit, then (after legacy's `<hr>`) the status,
// forced password change, forced 2FA enrollment and SOGo access with their legacy help. SOGo access
// is left out when the groupware is disabled, as legacy does. The `quota` slot replaces the quota
// field (the add mailbox form shows the domain's "max." badge). Fields a domain administrator's
// flags lock show "Prohibited by ACL" (`gates`).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MailboxCapabilities } from '@/api'
import { useBranding } from '@/app/branding/public-config'
import { lt } from '@/i18n'
import LegacyRateLimitField from '@/shared/components/LegacyRateLimitField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import TagSetInput from '@/shared/components/TagSetInput.vue'

import { PERMISSION_LABEL_KEYS, type Gate, type GatedField } from '../../acl'
import { useMailboxTagSuggestions } from '../../composables/useMailboxTagSuggestions'
import type { MailboxValues } from '../../form-values'
import { PROTOCOL_ORDER, type Permission, type Protocol } from '../../types'
import AclReadOnlyNote from '@/shared/components/AclReadOnlyNote.vue'
import LegacyCheckbox from './LegacyCheckbox.vue'
import LegacyRadioGroup from './LegacyRadioGroup.vue'
import MailboxQuotaField from './MailboxQuotaField.vue'
import MultiSelectField from './MultiSelectField.vue'
import {
  FRAME_KEYS,
  protocolKey,
  QUARANTINE_CATEGORY_OPTIONS,
  QUARANTINE_NOTIFICATION_OPTIONS,
  TAGGED_MAIL_OPTIONS,
} from './options'
import StatusSelect from './StatusSelect.vue'
import TlsPolicyField from './TlsPolicyField.vue'

const props = withDefaults(
  defineProps<{
    idPrefix: string
    modelValue: MailboxValues
    capabilities: MailboxCapabilities | undefined
    errorsFor: (path: string) => readonly string[]
    /** The gates of the caller's flags; fields without one are editable. */
    gates?: Partial<Record<GatedField, Gate>>
  }>(),
  { gates: () => ({}) },
)
const emit = defineEmits<{ 'update:modelValue': [value: MailboxValues] }>()
const { t } = useI18n()
const { branding } = useBranding()
const suggestions = useMailboxTagSuggestions()

function update<K extends keyof MailboxValues>(key: K, value: MailboxValues[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

const lockedBy = (field: GatedField) => {
  const gate = props.gates[field]
  return gate?.state === 'readOnly' ? gate.flag : null
}
const groupware = computed(() => props.capabilities?.groupwareEnabled !== false)
const protocolOptions = computed(() =>
  PROTOCOL_ORDER.map((protocol) => ({ value: protocol, label: t(protocolKey(protocol)) })),
)
const permissionOptions = computed(() =>
  props.modelValue.presentPermissions.map((key) => ({
    value: key,
    label: lt(PERMISSION_LABEL_KEYS[key]),
  })),
)
const tagChipErrors = computed(() => {
  const chips: Record<number, readonly string[]> = {}
  props.modelValue.tags.forEach((_, index) => {
    const messages = props.errorsFor(`tags.${index}`)
    if (messages.length > 0) chips[index] = messages
  })
  return chips
})
const id = (field: string) => `${props.idPrefix}-${field}`
const rateLimitLock = computed(() => lockedBy('rateLimit'))
const rateLimitText = computed(() =>
  props.modelValue.rateLimitValue.trim() === ''
    ? lt('ratelimit.disabled')
    : `${props.modelValue.rateLimitValue.trim()} ${lt(FRAME_KEYS[props.modelValue.rateLimitFrame])}`,
)
</script>

<template>
  <div class="flex flex-col gap-4">
    <TagSetInput
      :id="id('tags')"
      :model-value="modelValue.tags"
      :label="lt('add.tags')"
      :max-length="capabilities?.tagMaxLength ?? 255"
      :errors="errorsFor('tags')"
      :chip-errors="tagChipErrors"
      :suggestions="suggestions.suggestions.value"
      :suggestions-state="suggestions.state.value"
      @update:model-value="update('tags', [...$event])"
      @search="suggestions.search"
    />
    <slot name="quota">
      <MailboxQuotaField
        :id="id('quota')"
        :model-value="modelValue.quota"
        label-key="edit.quota_mb"
        :errors="errorsFor('quota')"
        @update:model-value="update('quota', $event)"
      />
    </slot>
    <LegacyRadioGroup
      :id-prefix="id('taggedMail')"
      legend-key="user.tag_handling"
      :model-value="modelValue.taggedMailHandling"
      :options="TAGGED_MAIL_OPTIONS"
      :help-keys="['user.tag_help_explain', 'user.tag_help_example']"
      @update:model-value="
        update('taggedMailHandling', $event as MailboxValues['taggedMailHandling'])
      "
    />
    <LegacyRadioGroup
      :id-prefix="id('quarantineNotification')"
      legend-key="user.quarantine_notification"
      :model-value="modelValue.quarantineNotification"
      :options="QUARANTINE_NOTIFICATION_OPTIONS"
      :help-keys="['user.quarantine_notification_info']"
      @update:model-value="
        update('quarantineNotification', $event as MailboxValues['quarantineNotification'])
      "
    />
    <LegacyRadioGroup
      :id-prefix="id('quarantineCategory')"
      legend-key="user.quarantine_category"
      :model-value="modelValue.quarantineCategory"
      :options="QUARANTINE_CATEGORY_OPTIONS"
      :help-keys="['user.quarantine_category_info']"
      @update:model-value="
        update('quarantineCategory', $event as MailboxValues['quarantineCategory'])
      "
    />
    <TlsPolicyField
      :id-prefix="id('tls')"
      :inbound="modelValue.tlsEnforceInbound"
      :outbound="modelValue.tlsEnforceOutbound"
      @update:inbound="update('tlsEnforceInbound', $event)"
      @update:outbound="update('tlsEnforceOutbound', $event)"
    />
    <MultiSelectField
      :id="id('protocols')"
      :model-value="modelValue.protocols"
      :label="lt('edit.allowed_protocols')"
      :options="protocolOptions"
      :errors="errorsFor('protocolAccess')"
      :locked-by="lockedBy('protocolAccess')"
      @update:model-value="update('protocols', $event as Protocol[])"
    />
    <MultiSelectField
      :id="id('permissions')"
      :model-value="modelValue.permissions"
      :label="t('mailboxes.acl.label')"
      :options="permissionOptions"
      :size="10"
      :errors="errorsFor('userPermissions')"
      @update:model-value="update('permissions', $event as Permission[])"
    />
    <div v-if="rateLimitLock" :data-locked="id('rateLimit')" class="flex flex-col gap-1.5 text-sm">
      <p class="font-medium text-gray-800 dark:text-gray-200">{{ lt('acl.ratelimit') }}</p>
      <p class="text-gray-900 dark:text-white">{{ rateLimitText }}</p>
      <AclReadOnlyNote :id="id('rateLimit-acl')" :flag="rateLimitLock" />
    </div>
    <div v-else class="flex flex-col gap-1.5">
      <LegacyRateLimitField
        :id-prefix="id('rateLimit')"
        :value="modelValue.rateLimitValue"
        :frame="modelValue.rateLimitFrame"
        label-key="acl.ratelimit"
        :errors="errorsFor('rateLimit')"
        @update:value="update('rateLimitValue', $event)"
        @update:frame="update('rateLimitFrame', $event)"
      />
      <LegacyText k="edit.mbox_rl_info" as="p" class="text-sm text-gray-600 dark:text-gray-400" />
    </div>
    <hr class="border-gray-200 dark:border-gray-800" />
    <StatusSelect
      :id="id('status')"
      :model-value="modelValue.status"
      keys="edit"
      @update:model-value="update('status', $event)"
    />
    <LegacyCheckbox
      :id="id('forcePasswordChange')"
      :model-value="modelValue.forcePasswordChange"
      label-key="edit.force_pw_update"
      help-key="edit.force_pw_update_info"
      :help-args="[branding.productName]"
      @update:model-value="update('forcePasswordChange', $event)"
    />
    <LegacyCheckbox
      :id="id('forceSecondFactorSetup')"
      :model-value="modelValue.forceSecondFactorSetup"
      label-key="tfa.force_tfa"
      help-key="tfa.force_tfa_info"
      @update:model-value="update('forceSecondFactorSetup', $event)"
    />
    <LegacyCheckbox
      v-if="groupware"
      :id="id('webmailRedirect')"
      :model-value="modelValue.webmailRedirect"
      label-key="edit.sogo_access"
      help-key="edit.sogo_access_info"
      :locked-by="lockedBy('webmailRedirect')"
      @update:model-value="update('webmailRedirect', $event)"
    />
  </div>
</template>
