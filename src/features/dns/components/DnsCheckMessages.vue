<script setup lang="ts">
// Reasons, notes or guidance of a diagnostics check (research R15): translated from their codes;
// the SPF addresses (with the fork's "Allow") and the suggested record as values to copy; the
// addresses of `matchedByAddressRecords` as text; a reference as a separate "Learn more" link; an
// unknown code with the API's English text.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DnsCheckMessage } from '@/api'
import { text } from '@/i18n'
import type { AppLocale } from '@/i18n/locales'
import { ExternalLinkIcon } from '@/shared/icons'

import { messageView } from '../diagnostics/check-messages'
import RecordValue from './RecordValue.vue'

const props = defineProps<{ messages: readonly DnsCheckMessage[] }>()
const { t, locale } = useI18n()

const views = computed(() =>
  props.messages.map((message) => ({
    code: message.code,
    view: messageView(message, locale.value as AppLocale),
  })),
)
</script>

<template>
  <ul class="flex flex-col gap-2 text-sm text-gray-800 dark:text-gray-200">
    <li v-for="(item, index) in views" :key="index" data-check-message class="flex flex-col gap-1">
      <template v-if="item.code === 'spfSuggestedRecord' && item.view.values.length > 0">
        <RecordValue
          :label="text(item.view.key, item.view.params)"
          :value="item.view.values[0]!"
          :copy-label="t('dns.diagnostics.copyValue', { value: item.view.values[0] })"
        />
      </template>
      <template v-else>
        <p class="break-words">
          {{ text(item.view.key, item.view.params) }}
          <span v-if="item.view.englishFallback" lang="en">{{ item.view.englishFallback }}</span>
        </p>
        <template v-if="item.code === 'spfAuthorizeAddresses'">
          <RecordValue
            v-for="value in item.view.values"
            :key="value"
            :label="t('dns.diagnostics.allow')"
            :value="value"
            :copy-label="t('dns.diagnostics.copyValue', { value })"
          />
        </template>
        <ul v-else-if="item.view.values.length > 0" class="flex flex-wrap gap-1">
          <li v-for="value in item.view.values" :key="value">
            <code class="font-mono break-all">{{ value }}</code>
          </li>
        </ul>
      </template>
      <a
        v-if="item.view.link"
        :href="item.view.link"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex min-h-11 items-center gap-1 self-start text-brand-700 underline underline-offset-2 dark:text-brand-300"
      >
        {{ t('dns.diagnostics.learnMore') }}
        <ExternalLinkIcon class="size-4" />
        <span class="sr-only">{{ t('common.opensInNewTab') }}</span>
      </a>
    </li>
  </ul>
</template>
