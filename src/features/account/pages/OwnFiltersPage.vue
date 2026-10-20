<script setup lang="ts">
import { ActiveScriptPanel } from '@/features/filters'
import { lt } from '@/i18n'
import PageHeader from '@/shared/components/PageHeader.vue'
import { useAccountContext } from '../composables/useAccountContext'
const context = useAccountContext()
</script>
<template>
  <section class="flex min-w-0 flex-col gap-5">
    <PageHeader :title="lt('user.active_sieve')" />
    <ActiveScriptPanel :mailbox="context.mailbox.value" />
  </section>
</template>
