<script setup lang="ts">
// The "Correct Data" of a check (legacy `diagnostics.dns_records_data`): the expected value with
// its copy button, or, for a check without an exact value, its guidance. In the table the column
// header labels it (`compact`); on a card it carries the classic label.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DnsCheck } from '@/api'
import { lt } from '@/i18n'
import CopyButton from '@/shared/components/CopyButton.vue'

import DnsCheckMessages from './DnsCheckMessages.vue'
import RecordValue from './RecordValue.vue'
import SpfProposal from './SpfProposal.vue'

const props = withDefaults(defineProps<{ check: DnsCheck; label: string; compact?: boolean }>(), {
  compact: false,
})
const guidance = computed(() =>
  props.check.guidance.filter(
    (message) =>
      props.check.id !== 'spf' ||
      !['spfSuggestedRecord', 'spfAuthorizeAddresses'].includes(message.code),
  ),
)
const { t } = useI18n()
const value = ref<HTMLElement | null>(null)
</script>

<template>
  <div class="flex min-w-0 flex-col gap-2">
    <template v-if="check.expected !== null">
      <div v-if="compact" class="flex min-w-0 flex-col items-start gap-1">
        <code ref="value" data-check-expected class="font-mono text-sm wrap-anywhere">{{
          check.expected
        }}</code>
        <CopyButton
          :text="check.expected"
          :label="t('dns.diagnostics.copyExpected', { check: label })"
          :select-target="value"
          icon-only
        />
      </div>
      <RecordValue
        v-else
        :label="lt('diagnostics.dns_records_data')"
        :value="check.expected"
        :copy-label="t('dns.diagnostics.copyExpected', { check: label })"
      />
    </template>
    <SpfProposal v-if="check.id === 'spf'" :check="check" />
    <template v-if="guidance.length > 0">
      <span
        v-if="!compact && check.expected === null"
        class="text-sm text-gray-600 dark:text-gray-400"
      >
        {{ lt('diagnostics.dns_records_data') }}
      </span>
      <DnsCheckMessages :messages="guidance" />
    </template>
  </div>
</template>
