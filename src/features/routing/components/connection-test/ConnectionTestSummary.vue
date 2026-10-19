<script setup lang="ts">
// The connection test result first (research R12, FR-046, SC-004): the verdict as a heading with
// an icon and text, the step reached or failed with its reason, the server's last reply
// (untranslated), then the server and whether an MX lookup found it, TLS, login, the addresses used
// and the time. Values from the server are shown as returned.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { RoutingConnectionTestResult } from '@/api'
import { lt } from '@/i18n'
import DateTime from '@/shared/components/DateTime.vue'
import { CheckIcon, DangerIcon } from '@/shared/icons'

import { testSummary } from '../../logic/test-summary'

const props = defineProps<{ result: RoutingConnectionTestResult }>()
const { t } = useI18n()
const view = computed(() => testSummary(props.result))
const stepLabel = computed(() => t(`routing.connectionTest.step.${view.value.step}`))
</script>

<template>
  <section
    aria-labelledby="test-result-title"
    data-test-summary
    class="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
  >
    <h2 id="test-result-title" class="sr-only">{{ t('routing.connectionTest.result') }}</h2>
    <h3
      class="flex items-center gap-2 text-lg font-semibold"
      :class="
        view.verdict === 'accepted'
          ? 'text-green-700 dark:text-green-400'
          : 'text-red-700 dark:text-red-400'
      "
    >
      <CheckIcon v-if="view.verdict === 'accepted'" class="size-5 shrink-0" />
      <DangerIcon v-else class="size-5 shrink-0" />
      {{ t(`routing.connectionTest.verdict.${view.verdict}`) }}
    </h3>
    <p class="font-medium text-gray-900 dark:text-white">
      {{
        view.verdict === 'accepted'
          ? t('routing.connectionTest.reached', { step: stepLabel })
          : t('routing.connectionTest.failedAt', { step: stepLabel })
      }}
    </p>
    <p v-if="view.reasonKey" class="text-gray-800 dark:text-gray-200">
      {{ t(view.reasonKey, { reason: view.unknownReason ?? '' }) }}
    </p>
    <p
      v-if="view.lastReply"
      translate="no"
      class="font-mono text-sm wrap-anywhere text-gray-900 dark:text-white"
    >
      {{ `${view.lastReply.code} ${view.lastReply.text}` }}
    </p>
    <p v-else class="text-sm text-gray-700 dark:text-gray-300">
      {{ t('routing.connectionTest.noReply') }}
    </p>
    <dl class="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ t('routing.connectionTest.server') }}</dt>
        <dd translate="no" class="wrap-anywhere text-gray-900 dark:text-white">
          <template v-if="view.server">
            {{ `${view.server.host}:${view.server.port}` }}
            <template v-if="view.server.viaMx">
              {{ t('routing.connectionTest.viaMx', { nextHop: view.server.nextHop }) }}
            </template>
          </template>
          <template v-else>{{ t('routing.connectionTest.notReached') }}</template>
        </dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ t('routing.connectionTest.step.tls') }}</dt>
        <dd class="text-gray-900 dark:text-white">
          {{ t(view.tls ? 'routing.connectionTest.tlsUsed' : 'routing.connectionTest.tlsNotUsed') }}
        </dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">
          {{ t('routing.connectionTest.step.login') }}
        </dt>
        <dd class="text-gray-900 dark:text-white">
          {{ t(`routing.connectionTest.login.${view.login}`) }}
        </dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('admin.relay_from') }}</dt>
        <dd translate="no" class="wrap-anywhere text-gray-900 dark:text-white">
          {{ view.sender }}
        </dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('admin.relay_rcpt') }}</dt>
        <dd translate="no" class="wrap-anywhere text-gray-900 dark:text-white">
          {{ view.recipient }}
        </dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ t('routing.connectionTest.time') }}</dt>
        <dd class="text-gray-900 dark:text-white">
          <DateTime :value="view.startedAt" />
          {{ t('routing.connectionTest.duration', { seconds: view.durationSeconds }) }}
        </dd>
      </div>
    </dl>
  </section>
</template>
