<script setup lang="ts">
import { useDataColumns } from '@/shared/composables/useDataList'
import DataTableHeader from '@/shared/components/DataTableHeader.vue'

import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import type { RecentLogin } from '@/api'
import { lt } from '@/i18n'
import DateTime from '@/shared/components/DateTime.vue'
import { recentLoginCountry } from '../../recent-login-country'
defineProps<{
  hidden?: boolean
  entries: RecentLogin[]
  appPasswordLink: (entry: RecentLogin) => RouteLocationRaw | undefined
}>()
const { t, locale } = useI18n()

const tableView = useDataColumns(() => [
  { id: 'clientAddress', label: t('auditLog.columns.address'), sort: 'clientAddress' },
  { id: 'service', label: lt('admin.service'), sort: 'service' },
  { id: 'lastSeenAt', label: lt('admin.time'), sort: 'lastSeenAt' },
  { id: 'appPassword', label: lt('user.app_name') },
])
</script>
<template>
  <div v-if="!hidden" class="table-frame">
    <table
      class="data-table w-full table-fixed text-start text-sm text-gray-800 dark:text-gray-200"
      data-recent-logins
    >
      <thead>
        <tr class="border-b border-gray-200 dark:border-gray-800">
          <DataTableHeader column="clientAddress" />
          <DataTableHeader column="service" />
          <DataTableHeader column="lastSeenAt" />
          <DataTableHeader column="appPassword" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(entry, index) in entries"
          :key="`${entry.service}:${entry.clientAddress}:${entry.lastSeenAt}:${index}`"
          class="border-b border-gray-200 dark:border-gray-800"
          data-login
        >
          <td
            v-show="tableView.visible('clientAddress')"
            :data-column="'clientAddress'"
            class="p-2 wrap-anywhere"
          >
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
          <td
            v-show="tableView.visible('service')"
            :data-column="'service'"
            class="p-2 wrap-anywhere"
          >
            <code>{{ entry.service }}</code>
          </td>
          <td v-show="tableView.visible('lastSeenAt')" :data-column="'lastSeenAt'" class="p-2">
            <DateTime :value="entry.lastSeenAt" />
          </td>
          <td
            v-show="tableView.visible('appPassword')"
            :data-column="'appPassword'"
            class="p-2 wrap-anywhere"
          >
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
  </div>
</template>
