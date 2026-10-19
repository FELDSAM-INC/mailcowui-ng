<script setup lang="ts">
// A DKIM entry as a card below md (FR-006, FR-083): a list item named by its heading (the readable
// name with the ASCII form, linking to the entry), the kind, the state, the selector (which filters
// the list) and the key length. Slots: `select` (selection mode) and `actions`.
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { DkimKey } from '@/api'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import DomainNameText from '@/shared/components/DomainNameText.vue'

import { dkimKeyLocation } from '../names'
import DkimKindLabel from './DkimKindLabel.vue'
import DkimStateBadge from './DkimStateBadge.vue'

defineProps<{ entry: DkimKey }>()
const emit = defineEmits<{ filterSelector: [selector: string] }>()
const { t, locale } = useI18n()
</script>

<template>
  <li
    class="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
  >
    <div class="flex items-start gap-2">
      <slot name="select" />
      <!-- eslint-disable-next-line vuejs-accessibility/heading-has-content -- the link is its content -->
      <h3 class="min-w-0 flex-1 text-base font-semibold text-gray-900 dark:text-white">
        <RouterLink
          :to="dkimKeyLocation(entry.name)"
          class="inline-flex min-h-11 items-center underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <DomainNameText :name="entry.name" :unicode-name="entry.displayName" />
        </RouterLink>
      </h3>
      <slot name="actions" />
    </div>
    <div class="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <DkimKindLabel :entry="entry" />
      <DkimStateBadge :entry="entry" />
    </div>
    <dl v-if="entry.key" class="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('admin.dkim_domains_selector') }}</dt>
        <dd class="font-mono break-all text-gray-900 dark:text-white">
          <button
            v-if="entry.key.selector"
            type="button"
            data-filter-selector
            class="min-h-11 text-start underline underline-offset-2"
            :aria-label="t('dns.dkim.filters.bySelector', { selector: entry.key.selector })"
            @click="emit('filterSelector', entry.key.selector)"
          >
            {{ entry.key.selector }}
          </button>
          <span v-else>–</span>
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
    </dl>
  </li>
</template>
