<script setup lang="ts">
// The facts of a DKIM entry (FR-016): kind, state, selector and key length, with the classic DKIM
// tab's labels.
import { useI18n } from 'vue-i18n'

import type { DkimKey } from '@/api'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'

import DkimKindLabel from './DkimKindLabel.vue'
import DkimStateBadge from './DkimStateBadge.vue'

defineProps<{ entry: DkimKey }>()
const { t, locale } = useI18n()
</script>

<template>
  <dl data-dkim-facts class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
    <div>
      <dt class="text-gray-600 dark:text-gray-400">{{ t('dns.dkim.filters.kind') }}</dt>
      <dd class="text-gray-900 dark:text-white"><DkimKindLabel :entry="entry" /></dd>
    </div>
    <div>
      <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.status') }}</dt>
      <dd><DkimStateBadge :entry="entry" /></dd>
    </div>
    <template v-if="entry.key">
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('admin.dkim_domains_selector') }}</dt>
        <dd class="font-mono break-all text-gray-900 dark:text-white">
          {{ entry.key.selector ?? '–' }}
        </dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('admin.dkim_key_length') }}</dt>
        <dd class="text-gray-900 dark:text-white">
          {{
            entry.key.keyLength === null
              ? '–'
              : formatNumber(entry.key.keyLength, locale as AppLocale)
          }}
        </dd>
      </div>
    </template>
  </dl>
</template>
