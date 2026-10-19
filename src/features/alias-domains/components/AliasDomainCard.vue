<script setup lang="ts">
// A domain alias as a card below md (FR-033), the classic table's columns
// (`draw_aliasdomain_table()`): the name as heading with a link to its page, the target domain and
// active. Slots: `select` (selection mode, US6) and `actions` (the entry menu).
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import type { AliasDomain } from '@/api'
import { YesNoMark } from '@/features/aliases'
import { lt } from '@/i18n'
import DomainNameText from '@/shared/components/DomainNameText.vue'

import TargetDomainText from './TargetDomainText.vue'

const props = defineProps<{ aliasDomain: AliasDomain; linkDomains: boolean }>()
const headingId = computed(() => `alias-domain-card-${props.aliasDomain.name}`)
</script>

<template>
  <li
    :data-entry="aliasDomain.name"
    class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
  >
    <article :aria-labelledby="headingId" class="flex flex-col gap-3">
      <div class="flex items-start gap-3">
        <slot name="select" />
        <!-- eslint-disable-next-line vuejs-accessibility/heading-has-content -- the link is its content -->
        <h3
          :id="headingId"
          class="min-w-0 flex-1 text-base font-semibold text-gray-900 dark:text-white"
        >
          <RouterLink
            :to="{ name: 'alias-domain-detail', params: { aliasDomain: aliasDomain.name } }"
            class="inline-flex min-h-11 max-w-full items-center underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <DomainNameText :name="aliasDomain.name" :unicode-name="aliasDomain.nameUnicode" />
          </RouterLink>
        </h3>
        <slot name="actions" />
      </div>
      <dl class="grid grid-cols-1 gap-2 text-sm">
        <div class="flex min-w-0 flex-col">
          <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.target_domain') }}</dt>
          <dd class="min-w-0 text-gray-900 dark:text-white">
            <TargetDomainText :alias-domain="aliasDomain" :link-domains="linkDomains" />
          </dd>
        </div>
        <div class="flex gap-1.5" data-field="active">
          <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.active') }}</dt>
          <dd class="text-gray-900 dark:text-white"><YesNoMark :value="aliasDomain.active" /></dd>
        </div>
      </dl>
    </article>
  </li>
</template>
