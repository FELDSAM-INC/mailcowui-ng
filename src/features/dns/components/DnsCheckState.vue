<script setup lang="ts">
// The "Current State" of a check (legacy `diagnostics.dns_records_status`): its status as icon and
// text, the optional marker with the classic footnote text, the values found, the reason and the
// notes.
import type { DnsCheck } from '@/api'
import { lt } from '@/i18n'

import DnsCheckFound from './DnsCheckFound.vue'
import DnsCheckMessages from './DnsCheckMessages.vue'
import DnsCheckStatusBadge from './DnsCheckStatusBadge.vue'

defineProps<{ check: DnsCheck }>()
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <DnsCheckStatusBadge :check="check" />
      <span
        v-if="check.optional"
        data-check-optional
        class="text-sm text-gray-700 dark:text-gray-300"
      >
        {{ lt('diagnostics.optional') }}
      </span>
    </div>
    <DnsCheckFound :found="check.found" />
    <DnsCheckMessages v-if="check.reason" :messages="[check.reason]" />
    <DnsCheckMessages v-if="check.notes.length > 0" :messages="check.notes" />
  </div>
</template>
