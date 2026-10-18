<script setup lang="ts">
// The impact of a bulk deletion (FR-047, research D22): every domain to be deleted with what it
// removes, from the list data (aliases, alias domains, assigned domain administrators), the rule
// for administrators left without a domain, and the domains skipped because they still have
// mailboxes or resources. Naming the accounts deleted would take one preview per domain (API gap
// G30).
import { useI18n } from 'vue-i18n'

import type { Domain } from '@/api'

defineProps<{ deletable: readonly Domain[]; skipped: readonly Domain[] }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-3 text-sm text-gray-700 dark:text-gray-300">
    <p>{{ t('domains.bulk.deleteIntro') }}</p>
    <ul class="flex max-h-60 flex-col gap-2 overflow-y-auto">
      <li
        v-for="domain in deletable"
        :key="domain.name"
        :data-bulk-impact="domain.name"
        class="flex flex-col"
      >
        <span class="font-medium break-all text-gray-900 dark:text-white">{{
          domain.unicodeName
        }}</span>
        <span class="break-words text-gray-700 dark:text-gray-300">
          {{
            t('domains.bulk.impactItem', {
              aliases: domain.usage.aliases,
              aliasDomains: domain.usage.aliasDomains,
              admins: domain.domainAdmins?.length
                ? domain.domainAdmins.join(', ')
                : t('domains.values.none'),
            })
          }}
        </span>
      </li>
    </ul>
    <p>{{ t('domains.bulk.adminRule') }}</p>
    <p>{{ t('domains.bulk.dataRule') }}</p>
    <div v-if="skipped.length > 0" data-bulk-skipped class="flex flex-col gap-1">
      <p class="font-medium text-gray-900 dark:text-white">{{ t('domains.bulk.skippedIntro') }}</p>
      <ul class="flex list-disc flex-col gap-0.5 ps-5">
        <li
          v-for="domain in skipped"
          :key="domain.name"
          class="break-all text-gray-700 dark:text-gray-300"
        >
          {{
            t('domains.bulk.skippedItem', {
              name: domain.unicodeName,
              mailboxes: domain.usage.mailboxes,
              resources: domain.usage.resources,
            })
          }}
        </li>
      </ul>
    </div>
  </div>
</template>
