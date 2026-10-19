<script setup lang="ts">
// The DNS records an MTA-STS policy needs (FR-046): `_mta-sts.<domain>` TXT with the identifier and
// `mta-sts.<domain>` pointing to the server, each name and value with its copy button. After a save
// that renewed the identifier, the TXT record is highlighted with "Update this record" (FR-050).
import { useI18n } from 'vue-i18n'

import type { MtaStsDnsRecord } from '@/api'
import { lt } from '@/i18n'
import { WarningIcon } from '@/shared/icons'

import RecordValue from './RecordValue.vue'

defineProps<{ records: readonly MtaStsDnsRecord[]; highlight: boolean }>()
const { t } = useI18n()
const highlighted = (record: MtaStsDnsRecord, on: boolean) =>
  on && record.type === 'TXT' && record.name.startsWith('_mta-sts.')
</script>

<template>
  <section aria-labelledby="mta-sts-records-title" class="flex flex-col gap-3">
    <h3 id="mta-sts-records-title" class="font-semibold text-gray-900 dark:text-white">
      {{ lt('diagnostics.dns_records') }}
    </h3>
    <ul class="flex flex-col gap-3">
      <li
        v-for="record in records"
        :key="`${record.type}-${record.name}`"
        :data-highlighted-record="highlighted(record, highlight) ? '' : undefined"
        :aria-describedby="highlighted(record, highlight) ? 'mta-sts-update-record' : undefined"
        class="flex flex-col gap-2 rounded-xl border p-3"
        :class="
          highlighted(record, highlight)
            ? 'border-2 border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950'
            : 'border-gray-200 dark:border-gray-800'
        "
      >
        <p
          v-if="highlighted(record, highlight)"
          id="mta-sts-update-record"
          class="inline-flex items-center gap-1 text-sm font-semibold text-amber-900 dark:text-amber-100"
        >
          <WarningIcon class="size-4" />{{ t('dns.mtaSts.updateRecord') }}
        </p>
        <RecordValue
          :label="lt('diagnostics.dns_records_name')"
          :value="record.name"
          :copy-label="t('dns.mtaSts.copyName', { record: record.name })"
        />
        <p class="text-sm text-gray-700 dark:text-gray-300">
          {{ lt('diagnostics.dns_records_type') }}: <code class="font-mono">{{ record.type }}</code>
        </p>
        <RecordValue
          :label="t('dns.dkim.record.value')"
          :value="record.value"
          :copy-label="t('dns.mtaSts.copyValue', { record: record.name })"
        />
      </li>
    </ul>
  </section>
</template>
