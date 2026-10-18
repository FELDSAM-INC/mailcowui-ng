<script setup lang="ts">
// The confirmation of a bulk deactivation (FR-045): the domains and the effect on their mailboxes.
import { useI18n } from 'vue-i18n'

import type { Domain } from '@/api'

defineProps<{ domains: readonly Pick<Domain, 'name' | 'unicodeName'>[] }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-3 text-sm text-gray-700 dark:text-gray-300">
    <p>{{ t('domains.bulk.deactivateEffect') }}</p>
    <ul class="flex max-h-60 list-disc flex-col gap-0.5 overflow-y-auto ps-5">
      <li
        v-for="domain in domains"
        :key="domain.name"
        class="break-all text-gray-700 dark:text-gray-300"
      >
        {{ domain.unicodeName }}
      </li>
    </ul>
  </div>
</template>
