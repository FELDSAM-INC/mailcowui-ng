<script setup lang="ts">
import DataCard from '@/shared/components/DataCard.vue'
import DataCardFields from '@/shared/components/DataCardFields.vue'
import YesNoMark from '@/shared/components/YesNoMark.vue'

// A mailbox template as a card below md (FR-058, FR-072), with the classic list's values in its
// order: the template name as heading with a link to its page and the Default mark, ID, quota, TLS
// in and out, the allowed protocols on one line, SOGo, forced 2FA as text and the active state,
// the actions, and the child row's values behind a disclosure. Slots: `select` and `actions`.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'

import { useTemplateDisplay } from '../../templates/display'
import type { MailboxTemplate } from '../../types'
import MailboxStatusBadge from '../display/MailboxStatusBadge.vue'
import DefaultBadge from './DefaultBadge.vue'
import { protocolColumnKey } from './template-columns'
import TemplateEntryDetails from './TemplateEntryDetails.vue'

const props = defineProps<{ template: MailboxTemplate }>()
const { t } = useI18n()
const display = useTemplateDisplay()
const id = computed(() => `template-card-${props.template.id}`)
const values = computed(() => [
  { key: 'id', label: t('lists.id'), value: String(props.template.id) },
  { key: 'quota', label: lt('mailbox.domain_quota'), value: display.quota(props.template.quota) },
  {
    key: 'tlsEnforceInbound',
    label: lt('mailbox.tls_enforce_in'),
    value: props.template.tlsEnforceInbound,
  },
  {
    key: 'tlsEnforceOutbound',
    label: lt('mailbox.tls_enforce_out'),
    value: props.template.tlsEnforceOutbound,
  },
  {
    key: 'protocols',
    label: lt('edit.allowed_protocols'),
    value: display.protocols(props.template),
  },
  {
    key: 'webmailRedirect',
    label: t(protocolColumnKey('webmailRedirect')),
    value: props.template.webmailRedirect,
  },
  {
    key: 'forceSecondFactorSetup',
    label: lt('mailbox.force_tfa'),
    value: props.template.forceSecondFactorSetup,
  },
])
const primary = computed(() => values.value.filter((item) => typeof item.value !== 'boolean'))
const flags = computed(() => values.value.filter((item) => typeof item.value === 'boolean'))
</script>

<template>
  <DataCard
    :data-entry="template.id"
    :title-id="`${id}-name`"
    :title="template.name"
    :to="{ name: 'mailbox-template-detail', params: { templateId: template.id } }"
    :details-id="`${id}-details`"
    :details-label="t('domainTemplates.list.detailsOf', { name: template.name })"
  >
    <template v-if="template.isDefault" #badges><DefaultBadge /></template>
    <template v-if="$slots.select" #select><slot name="select" /></template>
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    <DataCardFields>
      <div
        v-for="item in primary"
        :key="item.key"
        :data-column="item.key"
        :data-wide="item.key === 'protocols' ? '' : undefined"
        class="flex flex-wrap gap-x-1"
      >
        <dt class="text-gray-600 dark:text-gray-400">{{ item.label }}:</dt>
        <dd class="break-words text-gray-900 dark:text-white">
          {{ item.value }}
        </dd>
      </div>
      <div data-column="status" class="flex flex-wrap items-start gap-x-1">
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.active') }}:</dt>
        <dd><MailboxStatusBadge :status="template.status" /></dd>
      </div>
    </DataCardFields>
    <DataCardFields inline>
      <div v-for="item in flags" :key="item.key" :data-column="item.key">
        <dt>{{ item.label }}:</dt>
        <dd><YesNoMark :value="Boolean(item.value)" /></dd>
      </div>
    </DataCardFields>
    <template #details>
      <TemplateEntryDetails :data-entry-details="template.id" :template="template" />
    </template>
  </DataCard>
</template>
