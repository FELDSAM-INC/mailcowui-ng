<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useIdentityQuery } from '@/app/session/queries'
import NoAccessState from '@/app/states/NoAccessState.vue'
import AclReadOnlyNote from '@/shared/components/AclReadOnlyNote.vue'
import { mailboxAccess } from '../../sections'
const route = useRoute()
const identity = useIdentityQuery()
const access = computed(() =>
  mailboxAccess(route.meta.accountSection ?? 'appPasswords', identity.data.value),
)
</script>
<template>
  <div class="flex w-full min-w-0 flex-col gap-6">
    <NoAccessState v-if="access.mode === 'hidden' && identity.data.value" />
    <template v-else-if="identity.data.value">
      <AclReadOnlyNote
        v-if="access.mode === 'readOnly'"
        id="mailbox-account-read-only"
        :flag="access.flag"
      />
      <RouterView />
    </template>
  </div>
</template>
