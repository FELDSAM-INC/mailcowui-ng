<script setup lang="ts">
// The body of a domain alias deletion's confirmation (FR-029, research R11, US4-AS8), under
// legacy's `footer.delete_these_items`: the name, then what goes with it (its aliases with their
// number and send-as permissions, its temporary aliases, BCC maps and spam lists) and that its DKIM
// key is kept (contract `deleteAliasDomain`).
import { useI18n } from 'vue-i18n'

import type { AliasDomain } from '@/api'
import DomainNameText from '@/shared/components/DomainNameText.vue'

defineProps<{ aliasDomain: AliasDomain }>()
const { t } = useI18n()
</script>

<template>
  <div
    data-alias-domain-delete
    class="flex flex-col gap-3 text-sm text-gray-700 dark:text-gray-300"
  >
    <p class="font-medium text-gray-900 dark:text-white">
      <DomainNameText :name="aliasDomain.name" :unicode-name="aliasDomain.nameUnicode" />
    </p>
    <p>{{ t('aliasDomains.delete.impact', { count: aliasDomain.aliasCount }) }}</p>
  </div>
</template>
