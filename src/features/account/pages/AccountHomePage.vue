<script setup lang="ts">
// My account (UI 005 FR-001, FR-002, research R4; decision D1): legacy's "User Settings", the
// mailbox overview for mailbox users (US5), then the sections the account may open, in the classic
// user page's order. Only sections whose routes are registered are listed, so each story adds its
// own without a placeholder.
import { computed } from 'vue'

import { useIdentityQuery } from '@/app/session/queries'
import { lt } from '@/i18n'
import PageHeader from '@/shared/components/PageHeader.vue'

import SectionCard from '../components/layout/SectionCard.vue'
import { useOfferedSections } from '../composables/useOfferedSections'
import MailboxOverview from '../components/overview/MailboxOverview.vue'

const offered = useOfferedSections()
const identity = useIdentityQuery()
const isMailbox = computed(() => identity.data.value?.role === 'mailboxUser')
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="lt('header.user_settings')" />
    <MailboxOverview v-if="isMailbox" />
    <ul v-if="offered.length > 0" class="grid gap-3 sm:grid-cols-2" data-sections>
      <li v-for="section in offered" :key="section.id">
        <SectionCard :section="section" />
      </li>
    </ul>
  </section>
</template>
