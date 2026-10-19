<script setup lang="ts">
// The mailbox user's quarantine notifications (UI 006 US3, FR-039, FR-040, D10): legacy shows the
// two settings on the user page's "Mailbox settings" tab (`templates/user/tab-user-settings.twig`),
// which UI 005 plans as its mail settings page. Until that page exists, this interim page of the
// Quarantine section hosts the exported panel (title `user.quarantine_notification`, save
// `user.save_changes`); the orchestrator removes it when UI 005 mounts the panel.
import { computed, ref } from 'vue'

import { useIdentityQuery } from '@/app/session/queries'
import { lt } from '@/i18n'
import PageHeader from '@/shared/components/PageHeader.vue'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'

import NotificationSettingsPanel from '../components/NotificationSettingsPanel.vue'
import QuarantineSectionNav from '../components/QuarantineSectionNav.vue'

const identity = useIdentityQuery()
const mailbox = computed(() => identity.data.value?.username ?? '')
const dirty = ref(false)

useLeaveGuard(dirty, { messageKey: 'leaveGuard.body' })
</script>

<template>
  <section class="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-4">
    <QuarantineSectionNav />
    <PageHeader :title="lt('user.quarantine_notification')" />
    <NotificationSettingsPanel
      v-if="mailbox"
      :mailbox="mailbox"
      :title="lt('user.mailbox_settings')"
      @dirty="dirty = $event"
    />
  </section>
</template>
