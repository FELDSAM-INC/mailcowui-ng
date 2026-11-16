<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useIdentityQuery } from '@/app/session/queries'
import { canAccess } from '@/app/navigation/visibility'
import { problemOf } from '@/api'
import ActiveBadge from '@/shared/components/ActiveBadge.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { membershipOptions } from './api'
const props = defineProps<{ mailbox: string }>()
const { t } = useI18n()
const identity = useIdentityQuery()
const query = useQuery(computed(() => membershipOptions(props.mailbox)))
</script>
<template>
  <section
    v-if="query.data.value?.length || query.isError.value"
    class="space-y-3"
    data-group-memberships
  >
    <h3 class="text-base font-semibold">{{ t('nav.mailboxGroups') }}</h3>
    <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="query.refetch()" />
    <ul class="space-y-2 text-sm">
      <li
        v-for="group in query.data.value"
        :key="group.id"
        class="flex flex-wrap items-center gap-2"
      >
        <RouterLink
          v-if="canAccess('mailboxGroups', identity.data.value)"
          :to="{ name: 'mailbox-group-detail', params: { groupId: group.id } }"
          class="text-accent-text hover:underline"
          >{{ group.name }}</RouterLink
        >
        <span v-else>{{ group.name }}</span
        ><ActiveBadge :active="group.active" /><span
          v-if="group.address"
          class="wrap-anywhere text-muted"
          >{{ group.address }}</span
        >
      </li>
    </ul>
  </section>
</template>
