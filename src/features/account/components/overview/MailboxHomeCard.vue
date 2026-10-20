<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { problemOf } from '@/api'
import { lt } from '@/i18n'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { buttonVariants } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'

import { useOwnMailboxOverview } from '../../api/overview'
import QuotaUsage from './QuotaUsage.vue'
import WebmailAction from './WebmailAction.vue'

const query = useOwnMailboxOverview()
</script>

<template>
  <Card data-mailbox-home>
    <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ lt('user.overview') }}</h2>
    <div v-if="query.isPending.value" role="status" aria-busy="true">
      {{ lt('footer.loading') }}
    </div>
    <ProblemMessage
      v-else-if="!query.data.value"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <template v-else>
      <p class="wrap-anywhere">{{ query.data.value.address }}</p>
      <QuotaUsage :quota="query.data.value.quota" />
      <WebmailAction :enabled="query.data.value.webmail.enabled" />
    </template>
    <RouterLink
      to="/account"
      :class="buttonVariants({ variant: 'outline', class: 'self-start' })"
      >{{ lt('header.user_settings') }}</RouterLink
    >
  </Card>
</template>
