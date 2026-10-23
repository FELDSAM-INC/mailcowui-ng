<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { DomainAdmin } from '@/api'
import ActiveBadge from '@/shared/components/ActiveBadge.vue'
const props = withDefaults(
  defineProps<{
    assignments: DomainAdmin['domains']
    accountActive: boolean
    limit?: number
    linked?: boolean
  }>(),
  { limit: Infinity, linked: true },
)
const { t } = useI18n()
</script>
<template>
  <p v-if="!assignments.length" class="text-sm text-amber-800 dark:text-amber-200">
    {{ t('accounts.assignment.none') }}
  </p>
  <ul v-else class="flex flex-col gap-1">
    <li
      v-for="assignment in props.assignments.slice(0, limit)"
      :key="assignment.domain"
      class="wrap-anywhere"
    >
      <RouterLink
        v-if="linked && assignment.domainExists"
        :to="{ name: 'domain-detail', params: { domain: assignment.domain } }"
        :title="assignment.domain"
        class="inline-flex min-h-11 items-center underline underline-offset-4"
        >{{ assignment.domainUnicode }}</RouterLink
      >
      <span v-else :title="assignment.domain">{{ assignment.domainUnicode }}</span>
      <span
        v-if="!assignment.domainExists"
        class="block text-xs text-amber-800 dark:text-amber-200"
        >{{
          t(
            assignment.domain === 'ALL'
              ? 'accounts.assignment.catchAll'
              : 'accounts.assignment.missing',
          )
        }}</span
      >
      <ActiveBadge
        v-if="assignment.active !== accountActive"
        class="ms-1.5"
        :active="assignment.active"
      />
    </li>
    <li v-if="assignments.length > limit" class="text-sm text-gray-600 dark:text-gray-400">
      {{ t('accounts.assignment.more', { count: assignments.length - limit }) }}
    </li>
  </ul>
</template>
