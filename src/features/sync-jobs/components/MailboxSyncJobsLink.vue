<script setup lang="ts">
// The entry point into UI 003's mailbox page (FR-004, research R4): "Sync jobs" opens the list
// filtered to the mailbox. It is shown only when the identity may open sync jobs (a convenience:
// the API decides) and sends no request, so the mailbox page stays as fast as before.
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { canAccess } from '@/app/navigation/visibility'
import { useIdentityQuery } from '@/app/session/queries'
import { lt } from '@/i18n'
import { SyncIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

defineProps<{ address: string }>()
const identity = useIdentityQuery()
const allowed = computed(() => canAccess('syncJobs', identity.data.value))
</script>

<template>
  <RouterLink
    v-if="allowed"
    :to="{ name: 'sync-jobs', query: { mailbox: address } }"
    :class="buttonVariants({ variant: 'outline' })"
  >
    <SyncIcon />
    {{ lt('mailbox.sync_jobs') }}
  </RouterLink>
</template>
