<script setup lang="ts">
import { lt } from '@/i18n'
import PageHeader from '@/shared/components/PageHeader.vue'
import MailboxOverview from '../components/overview/MailboxOverview.vue'
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="lt('user.overview')" />
    <MailboxOverview :show-title="false" />
  </section>
</template>
