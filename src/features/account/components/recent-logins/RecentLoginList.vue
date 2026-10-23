<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { RecentLogin } from '@/api'
import RecentLoginCard from './RecentLoginCard.vue'
defineProps<{
  entries: RecentLogin[]
  appPasswordLink: (entry: RecentLogin) => RouteLocationRaw | undefined
}>()
</script>
<template>
  <ul class="flex flex-col gap-3" data-recent-logins>
    <li
      v-for="(entry, index) in entries"
      :key="`${entry.service}:${entry.clientAddress}:${entry.lastSeenAt}:${index}`"
      data-login
    >
      <RecentLoginCard :entry="entry" :app-password-link="appPasswordLink(entry)" />
    </li>
  </ul>
</template>
