<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useIdentityQuery } from '@/app/session/queries'
import NoAccessState from '@/app/states/NoAccessState.vue'
import { lt } from '@/i18n'
import AclReadOnlyNote from '@/shared/components/AclReadOnlyNote.vue'
import { mailboxAccess } from '../../sections'
const route = useRoute()
const identity = useIdentityQuery()
const access = computed(() =>
  mailboxAccess(route.meta.accountSection ?? 'appPasswords', identity.data.value),
)
</script>
<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-4">
    <RouterLink
      :to="{ name: 'mailbox-detail', params: { address: route.params.address } }"
      class="text-link flex min-h-11 items-center self-start"
      >{{ lt('edit.previous') }}</RouterLink
    >
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
