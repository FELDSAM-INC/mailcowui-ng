<script setup lang="ts">
// The host card's "IPs" (FR-029, legacy `#host_show_ip`): "Show public IP" only when the IP check is
// enabled; while it runs, legacy's loading text; then the IPv4 and IPv6 address, "-" for one the
// API could not determine; `debug.error_show_ip` when the lookup fails. When the check is off, or
// the lookup is refused because it was switched off meanwhile, legacy's explanation
// (`admin.ip_check_disabled`) and the capabilities are read again.
import { useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'

import { problemOf } from '@/api'
import { lt } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'
import { buttonVariants } from '@/shared/ui/button'

import { usePublicAddresses } from '../api'
import { operationsKeys } from '../../query-keys'

const props = defineProps<{ ipCheckEnabled: boolean | null }>()
const client = useQueryClient()
const query = usePublicAddresses()

const refused = computed(() => problemOf(query.error.value)?.is('ip-check-disabled') ?? false)
const disabled = computed(() => props.ipCheckEnabled === false || refused.value)
const failed = computed(() => query.isError.value && !refused.value)

async function show() {
  const result = await query.refetch()
  if (problemOf(result.error)?.is('ip-check-disabled')) {
    await client.invalidateQueries({ queryKey: operationsKeys.monitoring.capabilities() })
  }
}
</script>

<template>
  <div data-public-addresses class="flex flex-col gap-1">
    <LegacyText v-if="disabled" k="admin.ip_check_disabled" as="span" />
    <template v-else-if="query.data.value">
      <span class="wrap-anywhere tabular-nums" data-ipv4>{{ query.data.value.ipv4 ?? '-' }}</span>
      <span class="wrap-anywhere tabular-nums" data-ipv6>{{ query.data.value.ipv6 ?? '-' }}</span>
    </template>
    <template v-else-if="ipCheckEnabled">
      <p v-if="failed" data-ip-failed class="text-red-700 dark:text-red-300">
        {{ lt('debug.error_show_ip') }}
      </p>
      <div>
        <button
          type="button"
          :class="buttonVariants({ variant: 'default', size: 'sm' })"
          :aria-disabled="query.isFetching.value || undefined"
          @click="!query.isFetching.value && show()"
        >
          <span v-if="query.isFetching.value" role="status">{{
            lt('datatables.loadingRecords')
          }}</span>
          <span v-else>{{ lt('debug.show_ip') }}</span>
        </button>
      </div>
    </template>
  </div>
</template>
