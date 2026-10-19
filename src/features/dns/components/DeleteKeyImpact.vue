<script setup lang="ts">
// What deleting a DKIM key does (research R9, FR-037, FR-038), inside the classic confirmation
// (`footer.confirm_delete`, `footer.delete_these_items`): the entry with its kind, selector and
// length, the end of signing for a domain or alias domain, the permanent loss of the private key,
// and what happens to the DNS record.
import { useI18n } from 'vue-i18n'

import type { DkimKey } from '@/api'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import DomainNameText from '@/shared/components/DomainNameText.vue'

import DkimKindLabel from './DkimKindLabel.vue'

defineProps<{ entry: DkimKey; publication: boolean }>()
const { t, locale } = useI18n()
</script>

<template>
  <div data-delete-impact class="flex flex-col gap-3">
    <div class="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
      <p class="font-medium text-gray-900 dark:text-white">
        <DomainNameText :name="entry.name" :unicode-name="entry.displayName" />
      </p>
      <dl class="mt-2 grid grid-cols-1 gap-1 text-sm text-gray-700 dark:text-gray-300">
        <div class="flex flex-wrap gap-1">
          <dt class="text-gray-700 dark:text-gray-300">{{ t('dns.dkim.filters.kind') }}:</dt>
          <dd class="text-gray-700 dark:text-gray-300"><DkimKindLabel :entry="entry" /></dd>
        </div>
        <div v-if="entry.key?.selector" class="flex flex-wrap gap-1">
          <dt class="text-gray-700 dark:text-gray-300">{{ lt('admin.dkim_domains_selector') }}:</dt>
          <dd class="font-mono break-all text-gray-700 dark:text-gray-300">
            {{ entry.key.selector }}
          </dd>
        </div>
        <div v-if="entry.key?.keyLength" class="flex flex-wrap gap-1">
          <dt class="text-gray-700 dark:text-gray-300">{{ lt('admin.dkim_key_length') }}:</dt>
          <dd class="text-gray-700 dark:text-gray-300">
            {{ formatNumber(entry.key.keyLength, locale as AppLocale) }}
          </dd>
        </div>
      </dl>
    </div>
    <ul class="list-disc ps-5 text-gray-700 dark:text-gray-300">
      <li v-if="entry.kind !== 'none'" class="text-gray-700 dark:text-gray-300">
        {{ t('dns.dkim.delete.unsigned', { name: entry.displayName }) }}
      </li>
      <li class="text-gray-700 dark:text-gray-300">{{ t('dns.dkim.delete.privateKey') }}</li>
      <li class="text-gray-700 dark:text-gray-300">
        {{ publication ? t('dns.dkim.delete.recordRemoved') : t('dns.dkim.delete.recordStays') }}
      </li>
    </ul>
  </div>
</template>
