<script setup lang="ts">
// An alias as a card below md (FR-007, FR-012): the address as heading with a link to the alias page,
// the badges, then the classic table's columns as labelled values (`draw_alias_table()`): goto
// address, domain, SOGo visible (only with the groupware), the comments, internal and active.
// Slots: `select` (selection mode, US6) and `actions` (the entry menu, US3).
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import type { Alias } from '@/api'
import { lt } from '@/i18n'

import { YesNoMark } from '@/features/aliases-common'

import AddressText from './AddressText.vue'
import AliasBadges from './AliasBadges.vue'
import AliasDomainText from './AliasDomainText.vue'
import DestinationSummary from './DestinationSummary.vue'

const props = defineProps<{
  alias: Alias
  groupwareEnabled: boolean | undefined
  canSeeOrphaned: boolean
}>()
const headingId = computed(() => `alias-card-${props.alias.id}`)
const comment = (value: string) => value || '-'
</script>

<template>
  <li
    :data-entry="alias.id"
    class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
  >
    <article :aria-labelledby="headingId" class="flex flex-col gap-3">
      <div class="flex items-start gap-3">
        <slot name="select" />
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <!-- eslint-disable-next-line vuejs-accessibility/heading-has-content -- the link is its content -->
          <h3 :id="headingId" class="text-base font-semibold text-gray-900 dark:text-white">
            <RouterLink
              :to="{ name: 'alias-detail', params: { aliasId: alias.id } }"
              class="inline-flex min-h-11 max-w-full items-center underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <AddressText :address="alias.address" :address-unicode="alias.addressUnicode" />
            </RouterLink>
          </h3>
          <AliasBadges :alias="alias" :can-see-orphaned="canSeeOrphaned" />
        </div>
        <slot name="actions" />
      </div>
      <dl class="grid grid-cols-1 gap-2 text-sm">
        <div class="flex min-w-0 flex-col">
          <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.target_address') }}</dt>
          <dd class="min-w-0 text-gray-900 dark:text-white">
            <DestinationSummary :alias="alias" />
          </dd>
        </div>
        <div class="flex min-w-0 flex-col">
          <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.domain') }}</dt>
          <dd class="min-w-0 text-gray-900 dark:text-white"><AliasDomainText :alias="alias" /></dd>
        </div>
        <div class="flex min-w-0 flex-col">
          <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.public_comment') }}</dt>
          <dd class="min-w-0 break-words text-gray-900 dark:text-white">
            {{ comment(alias.publicComment) }}
          </dd>
        </div>
        <div class="flex min-w-0 flex-col">
          <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.private_comment') }}</dt>
          <dd class="min-w-0 break-words text-gray-900 dark:text-white">
            {{ comment(alias.privateComment) }}
          </dd>
        </div>
      </dl>
      <dl class="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div v-if="groupwareEnabled" class="flex gap-1.5" data-field="groupwareVisible">
          <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.sogo_visible') }}</dt>
          <dd class="text-gray-900 dark:text-white">
            <YesNoMark :value="alias.groupwareVisible" />
          </dd>
        </div>
        <div class="flex gap-1.5" data-field="internal">
          <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.internal') }}</dt>
          <dd class="text-gray-900 dark:text-white"><YesNoMark :value="alias.internal" /></dd>
        </div>
        <div class="flex gap-1.5" data-field="active">
          <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.active') }}</dt>
          <dd class="text-gray-900 dark:text-white"><YesNoMark :value="alias.active" /></dd>
        </div>
      </dl>
    </article>
  </li>
</template>
