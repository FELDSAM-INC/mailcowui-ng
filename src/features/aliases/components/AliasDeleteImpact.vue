<script setup lang="ts">
// The body of an alias deletion's confirmation (FR-029, research R11), under legacy's
// `footer.delete_these_items`: the address, then what goes with it. Mail to it is no longer
// accepted and other mailboxes' permissions to send as it are removed; for a catch-all, the
// permissions to send as any address of its domain (contract `deleteAlias`).
import { useI18n } from 'vue-i18n'

import type { Alias } from '@/api'

import AddressText from './AddressText.vue'

defineProps<{ alias: Alias }>()
const { t } = useI18n()
</script>

<template>
  <div data-alias-delete class="flex flex-col gap-3 text-sm text-gray-700 dark:text-gray-300">
    <p class="font-medium break-all text-gray-900 dark:text-white">
      <AddressText :address="alias.address" :address-unicode="alias.addressUnicode" />
    </p>
    <p>{{ t('aliases.delete.impact') }}</p>
    <p v-if="alias.kind === 'catchAll'">
      {{ t('aliases.delete.impactCatchAll', { domain: alias.domainUnicode }) }}
    </p>
  </div>
</template>
