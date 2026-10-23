<script setup lang="ts">
import DataCard from '@/shared/components/DataCard.vue'
import DataCardFields from '@/shared/components/DataCardFields.vue'

// A resource as a card below md (FR-042), the classic table's columns (`draw_resource_table()`):
// the description as heading with a link to its page, the address, kind, domain, multiple bookings
// and active. Slots: `select` (selection mode) and `actions` (the entry menu).
import { computed } from 'vue'

import type { Resource } from '@/api'
import YesNoMark from '@/shared/components/YesNoMark.vue'
import { lt } from '@/i18n'
import MessageText from '@/shared/components/MessageText.vue'

import BookingRuleBadge from './BookingRuleBadge.vue'

const props = defineProps<{ resource: Resource }>()
const headingId = computed(() => `resource-card-${props.resource.address}`)
const DT = 'text-gray-600 dark:text-gray-400'
const DD = 'min-w-0 break-all text-gray-900 dark:text-white'
</script>

<template>
  <DataCard
    :data-entry="resource.address"
    :title-id="headingId"
    :title="resource.description"
    :to="{ name: 'resource-detail', params: { resourceAddress: resource.address } }"
  >
    <template v-if="$slots.select" #select><slot name="select" /></template>
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    <DataCardFields>
      <div data-wide>
        <dt :class="DT">{{ lt('mailbox.alias') }}</dt>
        <dd :class="DD">{{ resource.addressUnicode }}</dd>
      </div>
      <div class="flex min-w-0 flex-col">
        <dt :class="DT">{{ lt('mailbox.kind') }}</dt>
        <dd :class="DD"><MessageText :k="`enums.resourceKind.${resource.kind}`" /></dd>
      </div>
      <div class="flex min-w-0 flex-col">
        <dt :class="DT">{{ lt('mailbox.domain') }}</dt>
        <dd :class="DD">{{ resource.domainUnicode }}</dd>
      </div>
      <div class="flex min-w-0 flex-col items-start">
        <dt :class="DT">{{ lt('mailbox.multiple_bookings') }}</dt>
        <dd><BookingRuleBadge :resource="resource" /></dd>
      </div>
      <div class="flex gap-1.5" data-field="active">
        <dt :class="DT">{{ lt('mailbox.active') }}</dt>
        <dd class="text-gray-900 dark:text-white"><YesNoMark :value="resource.active" /></dd>
      </div>
    </DataCardFields>
  </DataCard>
</template>
