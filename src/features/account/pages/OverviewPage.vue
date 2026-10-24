<script setup lang="ts">
import { lt } from '@/i18n'
import SettingsPage from '@/shared/components/SettingsPage.vue'
import MailboxOverview from '../components/overview/MailboxOverview.vue'
</script>

<template>
  <SettingsPage :title="lt('user.overview')">
    <MailboxOverview :show-title="false" />
  </SettingsPage>
</template>
