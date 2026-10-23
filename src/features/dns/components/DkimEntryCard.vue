<script setup lang="ts">
import DataCard from '@/shared/components/DataCard.vue'
import DataCardFields from '@/shared/components/DataCardFields.vue'

// A DKIM entry as a card below md (FR-006, FR-083): a list item named by its heading (the readable
// name with the ASCII form, linking to the entry), the kind, the state, the selector (which filters
// the list) and the key length. Slots: `select` (selection mode) and `actions`.
import { useI18n } from 'vue-i18n'

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
  <DataCard :data-entry="entry.name" :to="dkimKeyLocation(entry.name)">
    <template #title>
      <DomainNameText :name="entry.name" :unicode-name="entry.displayName" />
    </template>
    <template #badges>
      <DkimKindLabel :entry="entry" />
      <DkimStateBadge :entry="entry" />
    </template>
    <template v-if="$slots.select" #select><slot name="select" /></template>
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    <DataCardFields v-if="entry.key">
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('admin.dkim_domains_selector') }}</dt>
        <dd class="font-mono break-all text-gray-900 dark:text-white">
          <button
            v-if="entry.key.selector"
            type="button"
            data-filter-selector
            class="min-h-11 min-w-11 text-start underline underline-offset-2"
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
    </DataCardFields>
  </DataCard>
</template>
