<script setup lang="ts">
// The impact of deleting a relayhost (research R8, FR-018): the numbers of domains and mailboxes
// using it with up to ten names of each from two `limit=10` usage reads, "Show all" to the usage
// view, and that their assignments are cleared. A failed read still allows the deletion.
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { Relayhost } from '@/api'
import { lt } from '@/i18n'

import { relayhostUsageOptions } from '../../api/relayhosts'
import EntryNameList from '../common/EntryNameList.vue'

const props = defineProps<{ relayhosts: readonly Relayhost[] }>()
const { t } = useI18n()
const single = computed(() => (props.relayhosts.length === 1 ? props.relayhosts[0]! : null))
const totals = computed(() =>
  props.relayhosts.reduce(
    (sum, item) => ({
      domains: sum.domains + item.usage.domains,
      mailboxes: sum.mailboxes + item.usage.mailboxes,
    }),
    { domains: 0, mailboxes: 0 },
  ),
)
const id = computed(() => single.value?.id ?? 0)
const enabled = computed(() => !!single.value)
const domains = useQuery(
  computed(() => ({
    ...relayhostUsageOptions(id.value, { kind: 'domain', limit: 10, offset: 0, sort: 'name' }),
    enabled: enabled.value && totals.value.domains > 0,
  })),
)
const mailboxes = useQuery(
  computed(() => ({
    ...relayhostUsageOptions(id.value, { kind: 'mailbox', limit: 10, offset: 0, sort: 'name' }),
    enabled: enabled.value && totals.value.mailboxes > 0,
  })),
)
const names = (data: { data: { name: string }[] } | undefined) =>
  data?.data.map((item) => item.name) ?? []
const failed = computed(() => domains.isError.value || mailboxes.isError.value)
const inUse = computed(() => totals.value.domains + totals.value.mailboxes > 0)
</script>

<template>
  <div data-relayhost-impact class="flex flex-col gap-3 text-sm text-gray-700 dark:text-gray-300">
    <EntryNameList
      :names="
        relayhosts.map((item) => (item.username ? `${item.host} (${item.username})` : item.host))
      "
    />
    <template v-if="inUse">
      <dl class="flex flex-col gap-2">
        <div>
          <dt class="font-medium text-gray-900 dark:text-white">
            {{ `${lt('mailbox.domains')}: ${totals.domains}` }}
          </dt>
          <dd v-if="single && names(domains.data.value).length > 0">
            <EntryNameList :names="names(domains.data.value)" />
          </dd>
        </div>
        <div>
          <dt class="font-medium text-gray-900 dark:text-white">
            {{ `${lt('mailbox.mailboxes')}: ${totals.mailboxes}` }}
          </dt>
          <dd v-if="single && names(mailboxes.data.value).length > 0">
            <EntryNameList :names="names(mailboxes.data.value)" />
          </dd>
        </div>
      </dl>
      <p v-if="failed" role="status">{{ t('routing.relayhosts.delete.namesFailed') }}</p>
      <RouterLink
        v-if="single"
        :to="{ name: 'routing-relayhost-usage', params: { relayhostId: single.id } }"
        class="text-link self-start"
      >
        {{ t('routing.relayhosts.delete.showAll') }}
      </RouterLink>
      <p>
        {{ t('routing.relayhosts.delete.cleared') }}
        <span class="font-medium">{{ lt('edit.none_inherit') }}</span>
      </p>
    </template>
  </div>
</template>
