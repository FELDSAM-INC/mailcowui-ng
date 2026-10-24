<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useOfferedSections } from '../../composables/useOfferedSections'
import { problemOf } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'

import { useOwnMailboxOverview } from '../../api/overview'
import AddressLists from './AddressLists.vue'
import ProtocolAccessList from './ProtocolAccessList.vue'
import QuotaUsage from './QuotaUsage.vue'
import WebmailAction from './WebmailAction.vue'

const { t } = useI18n()
const offered = useOfferedSections()
const recoverySection = computed(() =>
  offered.value.find((section) => section.id === 'recoveryEmail'),
)
const query = useOwnMailboxOverview()
const format = useFormat()
withDefaults(defineProps<{ showTitle?: boolean }>(), { showTitle: true })
</script>

<template>
  <div class="flex min-w-0 flex-col gap-5" data-mailbox-overview>
    <h2 v-if="showTitle" class="text-lg font-semibold text-gray-900 dark:text-white">
      {{ lt('user.overview') }}
    </h2>
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
      <p class="font-medium wrap-anywhere text-gray-900 dark:text-white" data-mailbox-address>
        {{ query.data.value.address }}
      </p>
      <QuotaUsage :quota="query.data.value.quota" />
      <WebmailAction :enabled="query.data.value.webmail.enabled" />
      <ProtocolAccessList :access="query.data.value.protocolAccess" />
      <AddressLists :overview="query.data.value" />
      <dl class="flex flex-col gap-4 text-sm">
        <div>
          <dt class="font-medium text-gray-900 dark:text-white">
            {{ lt('user.pw_recovery_email') }}
          </dt>
          <dd class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 wrap-anywhere">
            <span>{{ query.data.value.recoveryEmail ?? '-' }}</span>
            <RouterLink
              v-if="recoverySection?.route"
              :to="{ name: recoverySection.route }"
              class="text-link"
              data-edit-recovery-email
              >{{ t('sections.edit') }}</RouterLink
            >
          </dd>
        </div>
        <div>
          <dt class="font-medium text-gray-900 dark:text-white">{{ lt('user.last_pw_change') }}</dt>
          <dd class="mt-1">
            <time
              v-if="query.data.value.passwordChangedAt"
              :datetime="query.data.value.passwordChangedAt"
              >{{ format.dateTime(query.data.value.passwordChangedAt) }}</time
            >
            <template v-else>-</template>
          </dd>
        </div>
      </dl>
    </template>
  </div>
</template>
