<script setup lang="ts">
// A mailbox template as a card below md (FR-058, FR-072), with the classic list's values in its
// order: the template name as heading with a link to its page and the Default mark, ID, quota, TLS
// in and out, the allowed protocols on one line, SOGo, forced 2FA as text and the active state,
// the actions, and the child row's values behind a disclosure. Slots: `select` and `actions`.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lt } from '@/i18n'
import { ChevronDownIcon } from '@/shared/icons'

import { useTemplateDisplay } from '../../templates/display'
import type { MailboxTemplate } from '../../types'
import MailboxStatusBadge from '../display/MailboxStatusBadge.vue'
import DefaultBadge from './DefaultBadge.vue'
import { protocolColumnKey } from './template-columns'
import TemplateEntryDetails from './TemplateEntryDetails.vue'

const props = defineProps<{ template: MailboxTemplate }>()
const { t } = useI18n()
const display = useTemplateDisplay()
const expanded = ref(false)
const id = computed(() => `template-card-${props.template.id}`)
const values = computed(() => [
  { key: 'id', label: t('lists.id'), value: String(props.template.id) },
  { key: 'quota', label: lt('mailbox.domain_quota'), value: display.quota(props.template.quota) },
  {
    key: 'tlsEnforceInbound',
    label: lt('mailbox.tls_enforce_in'),
    value: display.yesNo(props.template.tlsEnforceInbound),
  },
  {
    key: 'tlsEnforceOutbound',
    label: lt('mailbox.tls_enforce_out'),
    value: display.yesNo(props.template.tlsEnforceOutbound),
  },
  {
    key: 'protocols',
    label: lt('edit.allowed_protocols'),
    value: display.protocols(props.template),
  },
  {
    key: 'webmailRedirect',
    label: t(protocolColumnKey('webmailRedirect')),
    value: display.yesNo(props.template.webmailRedirect),
  },
  {
    key: 'forceSecondFactorSetup',
    label: lt('mailbox.force_tfa'),
    value: display.yesNo(props.template.forceSecondFactorSetup),
  },
])
</script>

<template>
  <li
    :data-entry="template.id"
    class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
  >
    <article :aria-labelledby="`${id}-name`" class="flex flex-col gap-3">
      <div class="flex items-start gap-3">
        <slot name="select" />
        <div class="flex min-w-0 flex-1 flex-col items-start gap-1">
          <!-- eslint-disable-next-line vuejs-accessibility/heading-has-content -- the link is its content -->
          <h3 :id="`${id}-name`" class="text-base font-semibold text-gray-900 dark:text-white">
            <RouterLink
              :to="{ name: 'mailbox-template-detail', params: { templateId: template.id } }"
              class="inline-flex min-h-11 min-w-11 items-center break-words underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              {{ template.name }}
            </RouterLink>
          </h3>
          <DefaultBadge v-if="template.isDefault" />
        </div>
      </div>
      <dl class="grid grid-cols-1 gap-x-6 gap-y-1 text-sm">
        <div
          v-for="item in values"
          :key="item.key"
          :data-column="item.key"
          class="flex flex-wrap gap-x-1"
        >
          <dt class="text-gray-600 dark:text-gray-400">{{ item.label }}:</dt>
          <dd class="break-words text-gray-900 dark:text-white">{{ item.value }}</dd>
        </div>
        <div data-column="status" class="flex flex-wrap items-start gap-x-1">
          <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.active') }}:</dt>
          <dd><MailboxStatusBadge :status="template.status" /></dd>
        </div>
      </dl>
      <button
        type="button"
        class="inline-flex min-h-11 items-center gap-2 self-start rounded-lg px-2 text-sm font-medium text-accent-text bg-white dark:bg-gray-900 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
        :aria-expanded="expanded ? 'true' : 'false'"
        :aria-controls="`${id}-details`"
        :aria-label="t('domainTemplates.list.detailsOf', { name: template.name })"
        @click="expanded = !expanded"
      >
        <ChevronDownIcon
          class="size-4 motion-safe:transition-transform"
          :class="expanded ? 'rotate-180' : ''"
        />
        {{ t('domains.list.details') }}
      </button>
      <div v-if="expanded" :id="`${id}-details`" :data-entry-details="template.id">
        <TemplateEntryDetails :template="template" />
      </div>
      <slot name="actions" />
    </article>
  </li>
</template>
