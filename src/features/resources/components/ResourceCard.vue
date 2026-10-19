<script setup lang="ts">
// A resource as a card below md (FR-042), the classic table's columns (`draw_resource_table()`):
// the description as heading with a link to its page, the address, kind, domain, multiple bookings
// and active. Slots: `select` (selection mode) and `actions` (the entry menu).
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import type { Resource } from '@/api'
import { YesNoMark } from '@/features/aliases'
import { lt } from '@/i18n'
import MessageText from '@/shared/components/MessageText.vue'

import BookingRuleBadge from './BookingRuleBadge.vue'

const props = defineProps<{ resource: Resource }>()
const headingId = computed(() => `resource-card-${props.resource.address}`)
const DT = 'text-gray-600 dark:text-gray-400'
const DD = 'min-w-0 break-all text-gray-900 dark:text-white'
</script>

<template>
  <li
    :data-entry="resource.address"
    class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
  >
    <article :aria-labelledby="headingId" class="flex flex-col gap-3">
      <div class="flex items-start gap-3">
        <slot name="select" />
        <!-- eslint-disable-next-line vuejs-accessibility/heading-has-content -- the link is its content -->
        <h3
          :id="headingId"
          class="min-w-0 flex-1 text-base font-semibold break-words text-gray-900 dark:text-white"
        >
          <RouterLink
            :to="{ name: 'resource-detail', params: { resourceAddress: resource.address } }"
            class="inline-flex min-h-11 max-w-full items-center underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            {{ resource.description }}
          </RouterLink>
        </h3>
        <slot name="actions" />
      </div>
      <dl class="grid grid-cols-1 gap-2 text-sm">
        <div class="flex min-w-0 flex-col">
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
      </dl>
    </article>
  </li>
</template>
