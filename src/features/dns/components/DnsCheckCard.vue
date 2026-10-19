<script setup lang="ts">
// A diagnostics check as a card below md (FR-059, FR-061, FR-068, FR-083): a list item named by
// its purpose; the record name with its copy button, the type, the expected value or guidance, and
// the current state with the values found, the reason and the notes.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DnsCheck } from '@/api'
import { lt, text } from '@/i18n'

import { checkLabel } from '../diagnostics/check-labels'
import DnsCheckExpected from './DnsCheckExpected.vue'
import DnsCheckState from './DnsCheckState.vue'
import RecordValue from './RecordValue.vue'

const props = defineProps<{ check: DnsCheck }>()
const { t } = useI18n()
const label = computed(() => {
  const view = checkLabel(props.check)
  return text(view.key, view.params)
})
</script>

<template>
  <li
    data-check
    :data-check-id="check.id"
    class="flex min-w-0 flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
  >
    <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ label }}</h3>
    <RecordValue
      :label="lt('diagnostics.dns_records_name')"
      :value="check.recordName"
      :copy-label="t('dns.diagnostics.copyName', { check: label })"
    />
    <p class="text-sm text-gray-800 dark:text-gray-200">
      <span class="text-gray-600 dark:text-gray-400"
        >{{ lt('diagnostics.dns_records_type') }}:</span
      >
      <code class="ms-1 font-mono">{{ check.recordType }}</code>
    </p>
    <DnsCheckExpected :check="check" :label="label" />
    <div class="flex flex-col gap-1">
      <span class="text-sm text-gray-600 dark:text-gray-400">{{
        lt('diagnostics.dns_records_status')
      }}</span>
      <DnsCheckState :check="check" />
    </div>
  </li>
</template>
