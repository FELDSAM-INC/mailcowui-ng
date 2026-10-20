<script setup lang="ts">
// The section's existing title, mailbox subtitle and administrator-only audit history (R5/R22).
import { computed } from 'vue'

import { useIdentityQuery } from '@/app/session/queries'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import PageHeader from '@/shared/components/PageHeader.vue'

import { useAccountContext } from '../../composables/useAccountContext'

defineProps<{ title: string; targetType?: 'appPassword' | 'temporaryAlias' | 'sieveFilter' }>()
const context = useAccountContext()
const identity = useIdentityQuery()
const mailbox = computed(() =>
  context.kind.value === 'mailbox' ? context.mailbox.value : undefined,
)
const historyAllowed = computed(() => !!mailbox.value && identity.data.value?.role === 'admin')
</script>

<template>
  <PageHeader :title="title" :description="mailbox">
    <template v-if="historyAllowed || $slots.actions" #actions>
      <HistoryLink :allowed="historyAllowed" :target-type="targetType" :target-id="mailbox" />
      <slot name="actions" />
    </template>
  </PageHeader>
</template>
