<script setup lang="ts">
import DataCard from '@/shared/components/DataCard.vue'

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { type RouteLocationRaw } from 'vue-router'
import type { RecentLogin } from '@/api'
import DateTime from '@/shared/components/DateTime.vue'
import { recentLoginCountry } from '../../recent-login-country'
const props = defineProps<{ entry: RecentLogin; appPasswordLink?: RouteLocationRaw }>()
const { t, locale } = useI18n()
const country = computed(() =>
  props.entry.internal ? null : recentLoginCountry(props.entry.country, locale.value),
)
</script>
<template>
  <DataCard
    as="article"
    :title="
      entry.internal
        ? t('account.recentLogins.internal', { address: entry.clientAddress })
        : entry.clientAddress
    "
  >
    <p v-if="country" data-country>{{ country }}</p>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <code>{{ entry.service }}</code>
      <DateTime :value="entry.lastSeenAt" />
    </div>
    <span v-if="entry.appPassword?.name && appPasswordLink" class="wrap-anywhere">{{
      entry.appPassword.name
    }}</span>
    <p v-else-if="entry.appPassword">
      {{ entry.appPassword.name ?? t('account.recentLogins.appPasswordFallback') }}
    </p>
  </DataCard>
</template>
