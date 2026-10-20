<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import type { RecentLogin } from '@/api'
import { lt } from '@/i18n'
import DateTime from '@/shared/components/DateTime.vue'
import { recentLoginCountry } from '../../recent-login-country'
defineProps<{
  entries: RecentLogin[]
  appPasswordLink: (entry: RecentLogin) => RouteLocationRaw | undefined
}>()
const { t, locale } = useI18n()
</script>
<template>
  <table
    class="w-full table-fixed text-start text-sm text-gray-800 dark:text-gray-200"
    data-recent-logins
  >
    <thead>
      <tr class="border-b border-gray-200 dark:border-gray-800">
        <th class="w-2/5 p-2 text-start">{{ t('auditLog.columns.address') }}</th>
        <th class="p-2 text-start">{{ lt('admin.service') }}</th>
        <th class="p-2 text-start">{{ lt('admin.time') }}</th>
        <th class="p-2 text-start">{{ lt('user.app_name') }}</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(entry, index) in entries"
        :key="`${entry.service}:${entry.clientAddress}:${entry.lastSeenAt}:${index}`"
        class="border-b border-gray-200 dark:border-gray-800"
        data-login
      >
        <td class="p-2 wrap-anywhere">
          <p>
            {{
              entry.internal
                ? t('account.recentLogins.internal', { address: entry.clientAddress })
                : entry.clientAddress
            }}
          </p>
          <p v-if="!entry.internal && entry.country" data-country>
            {{ recentLoginCountry(entry.country, locale) }}
          </p>
        </td>
        <td class="p-2 wrap-anywhere">
          <code>{{ entry.service }}</code>
        </td>
        <td class="p-2"><DateTime :value="entry.lastSeenAt" /></td>
        <td class="p-2 wrap-anywhere">
          <RouterLink
            v-if="entry.appPassword?.name && appPasswordLink(entry)"
            :to="appPasswordLink(entry)!"
            class="inline-flex min-h-11 items-center underline"
            >{{ entry.appPassword.name }}</RouterLink
          >
          <span v-else-if="entry.appPassword">{{
            entry.appPassword.name ?? t('account.recentLogins.appPasswordFallback')
          }}</span>
        </td>
      </tr>
    </tbody>
  </table>
</template>
