<script setup lang="ts">
// The values of a list entry that are not columns (FR-007): "relay this domain", the domain
// administrators (administrators only), the creation and modification times, the mailbox quotas
// and the rate limit.
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import type { Domain } from '@/api'

import { useDomainFormat } from '../../format'

defineProps<{ domain: Domain; canSeeDomainAdmins: boolean }>()
const { t } = useI18n()
const format = useDomainFormat()
</script>

<template>
  <dl class="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
    <div>
      <dt class="text-gray-600 dark:text-gray-400">{{ lt('edit.relay_domain') }}</dt>
      <dd class="text-gray-900 dark:text-white">{{ format.yesNo(domain.backupMx) }}</dd>
    </div>
    <div>
      <dt class="text-gray-600 dark:text-gray-400">{{ t('domains.fields.maxMailboxQuota') }}</dt>
      <dd class="text-gray-900 dark:text-white">{{ format.quota(domain.maxMailboxQuota) }}</dd>
    </div>
    <div>
      <dt class="text-gray-600 dark:text-gray-400">{{ lt('edit.ratelimit') }}</dt>
      <dd class="text-gray-900 dark:text-white">{{ format.rateLimit(domain.rateLimit) }}</dd>
    </div>
    <div v-if="canSeeDomainAdmins">
      <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.domain_admins') }}</dt>
      <dd class="break-words text-gray-900 dark:text-white">
        {{
          domain.domainAdmins?.length ? domain.domainAdmins.join(', ') : t('domains.values.none')
        }}
      </dd>
    </div>
    <div>
      <dt class="text-gray-600 dark:text-gray-400">{{ lt('edit.created_on') }}</dt>
      <dd class="text-gray-900 dark:text-white">{{ format.time(domain.createdAt) }}</dd>
    </div>
    <div>
      <dt class="text-gray-600 dark:text-gray-400">{{ lt('edit.last_modified') }}</dt>
      <dd class="text-gray-900 dark:text-white">{{ format.time(domain.modifiedAt) }}</dd>
    </div>
  </dl>
</template>
