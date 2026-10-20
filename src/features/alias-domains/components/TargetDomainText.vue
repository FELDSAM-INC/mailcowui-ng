<script setup lang="ts">
// The target domain of an alias domain: linked to UI 002's domain page when that screen is
// available, with legacy's relay badge when the target became a relay domain.
import { RouterLink } from 'vue-router'

import type { AliasDomain } from '@/api'
import DomainNameText from '@/shared/components/DomainNameText.vue'

import RelayWarning from './RelayWarning.vue'

defineProps<{ aliasDomain: AliasDomain; linkDomains: boolean }>()
</script>

<template>
  <span class="flex min-w-0 flex-col items-start gap-1">
    <RouterLink
      v-if="linkDomains"
      :to="{ name: 'domain-detail', params: { domain: aliasDomain.targetDomain } }"
      class="inline-flex min-h-11 max-w-full items-center text-accent-text bg-white dark:bg-gray-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      <DomainNameText
        :name="aliasDomain.targetDomain"
        :unicode-name="aliasDomain.targetDomainUnicode"
      />
    </RouterLink>
    <DomainNameText
      v-else
      :name="aliasDomain.targetDomain"
      :unicode-name="aliasDomain.targetDomainUnicode"
    />
    <RelayWarning v-if="aliasDomain.targetIsRelayDomain" />
  </span>
</template>
