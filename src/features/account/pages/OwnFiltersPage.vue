<script setup lang="ts">
import { ActiveScriptPanel } from '@/features/filters'
import { lt } from '@/i18n'
import SettingsPage from '@/shared/components/SettingsPage.vue'
import { useAccountContext } from '../composables/useAccountContext'
const context = useAccountContext()
</script>
<template>
  <SettingsPage :title="lt('user.active_sieve')">
    <ActiveScriptPanel :mailbox="context.mailbox.value" />
  </SettingsPage>
</template>
