<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DnsCheck } from '@/api'
import { spfProposal } from '../diagnostics/spf-proposal'
import RecordValue from './RecordValue.vue'

const props = defineProps<{ check: DnsCheck }>()
const { t } = useI18n()
const proposal = computed(() => spfProposal(props.check))
</script>

<template>
  <div class="flex min-w-0 flex-col gap-2" data-spf-proposal>
    <p class="text-sm">{{ t(`dns.spfProposal.${proposal.kind}`) }}</p>
    <RecordValue
      v-if="proposal.record"
      :label="t('dns.spfProposal.title')"
      :value="proposal.record"
      :copy-label="t('dns.spfProposal.copy')"
    />
  </div>
</template>
