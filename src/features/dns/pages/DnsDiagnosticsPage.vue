<script setup lang="ts">
// The DNS diagnostics of a domain or alias domain (US3, FR-057 to FR-069, FR-091; legacy
// `dnsInfoModal` with `inc/ajax/dns_diagnostics.php`, as a page): the classic heading, notice and
// columns; the run state; the summary with the attention filter; the server facts; the checks in
// the API's order, server-wide first; the zone file. Opening the page starts a run unless a result
// of the last ten minutes is held; "Run again" starts one. The start and the end are announced
// without moving the focus. An unknown name, or one outside the scope, shows the not-found page.
import { skipToken, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { isApiProblem, queryKeys, type DnsCheck } from '@/api'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { lt } from '@/i18n'
import { formatList, formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import DomainNameText from '@/shared/components/DomainNameText.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { InfoIcon, WarningIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { useDnsCapabilities } from '../api/capabilities'
import {
  changedAfter,
  diagnosticsOptions,
  DIAGNOSTICS_FRESH_MS,
  type ChangedMarker,
} from '../api/diagnostics'
import DiagnosticsRunStatus from '../components/DiagnosticsRunStatus.vue'
import DiagnosticsServerFacts from '../components/DiagnosticsServerFacts.vue'
import DiagnosticsSummary from '../components/DiagnosticsSummary.vue'
import DiagnosticsZoneFile from '../components/DiagnosticsZoneFile.vue'
import DnsCheckList from '../components/DnsCheckList.vue'
import DnsCheckMessages from '../components/DnsCheckMessages.vue'
import type { RateLimitState } from '../diagnostics/rate-limit'
import { needsLook, SUMMARY_GROUPS, summarize } from '../diagnostics/summary-groups'

const { t, locale } = useI18n()
const route = useRoute()
const client = useQueryClient()
const capabilities = useDnsCapabilities()

const name = computed(() => String(route.params.diagnosticsName ?? ''))
const runTimeout = computed(() => capabilities.data.value?.dnsDiagnostics.runTimeoutSeconds ?? 30)
const query = useQuery(computed(() => diagnosticsOptions(client, name.value, runTimeout.value)))
const rateLimit = useQuery({
  queryKey: queryKeys.dnsDiagnostics.rateLimit(),
  queryFn: skipToken,
  staleTime: Infinity,
  gcTime: DIAGNOSTICS_FRESH_MS,
})
const marker = useQuery(
  computed(() => ({
    queryKey: queryKeys.dnsDiagnostics.changed(name.value),
    queryFn: skipToken,
    staleTime: Infinity,
    gcTime: DIAGNOSTICS_FRESH_MS,
  })),
)

const limit = computed(() => rateLimit.data.value as RateLimitState | undefined)
const entry = computed(() => query.data.value)
const result = computed(() => entry.value?.result)
const notFound = computed(
  () => !entry.value && isApiProblem(query.error.value) && query.error.value.status === 404,
)
const running = computed(() => query.isFetching.value)
const changed = computed(() =>
  changedAfter(entry.value, marker.data.value as ChangedMarker | undefined),
)

const onlyAttention = ref(false)
const shown = (checks: readonly DnsCheck[]) =>
  onlyAttention.value ? checks.filter(needsLook) : checks
const serverChecks = computed(() =>
  shown(result.value?.checks.filter((check) => check.scope === 'server') ?? []),
)
const nameChecks = computed(() =>
  shown(result.value?.checks.filter((check) => check.scope !== 'server') ?? []),
)
const partial = computed(() => (result.value?.summary.lookupFailed ?? 0) > 0)
const resultNotes = computed(
  () => result.value?.notes.filter((note) => note.code !== 'propagationDelay') ?? [],
)

function countsText(checks: readonly DnsCheck[]): string {
  const groups = summarize(checks).groups
  const parts = SUMMARY_GROUPS.filter((group) => groups[group] > 0).map((group) =>
    t(`dns.diagnostics.summary.groups.${group}`, {
      count: formatNumber(groups[group], locale.value as AppLocale),
    }),
  )
  return formatList(parts, locale.value as AppLocale)
}

// FR-084: the start and the end of a run are announced politely, without moving the focus.
watch(
  running,
  (now, before) => {
    if (now && !before) announce(t('dns.diagnostics.run.started', { name: name.value }))
    if (!now && before && query.isSuccess.value && !query.error.value && result.value) {
      announce(t('dns.diagnostics.run.finished', { counts: countsText(result.value.checks) }))
    }
  },
  { immediate: true },
)

function runAgain() {
  if (running.value) return
  void query.refetch()
}

const LONG = 'h-auto min-h-11 max-w-full shrink whitespace-normal text-start'
</script>

<template>
  <NotFoundPage v-if="notFound" :back-to="{ name: 'dkim-keys' }" :back-label="t('common.back')" />
  <article v-else class="mx-auto flex w-full max-w-7xl flex-col gap-4" :data-diagnostics="name">
    <header class="flex flex-col gap-2">
      <h1
        tabindex="-1"
        class="text-2xl font-semibold text-gray-900 focus:outline-none dark:text-white"
      >
        {{ lt('diagnostics.dns_records') }}
      </h1>
      <p class="text-lg text-gray-800 dark:text-gray-200">
        <DomainNameText :name="name" :unicode-name="result?.displayName ?? name" />
      </p>
      <div
        v-if="result?.aliasDomain && result.targetDomain"
        data-alias-target
        class="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300"
      >
        <p>{{ t('dns.diagnostics.aliasOf', { target: result.targetDomain }) }}</p>
        <p>{{ t('dns.diagnostics.aliasMtaSts', { target: result.targetDomain }) }}</p>
      </div>
    </header>

    <LegacyText
      k="diagnostics.dns_records_24hours"
      as="p"
      class="text-sm text-gray-700 dark:text-gray-300"
    />

    <DiagnosticsRunStatus
      :running="running"
      :error="query.error.value"
      :rate-limit="limit"
      :run-timeout-seconds="runTimeout"
      :has-result="!!result"
      @run-again="runAgain"
    />

    <template v-if="result">
      <p
        v-if="partial"
        role="note"
        data-diagnostics-partial
        class="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      >
        <WarningIcon class="mt-0.5 size-4 shrink-0" />{{ t('dns.diagnostics.partial') }}
      </p>
      <div
        v-if="changed"
        data-diagnostics-changed
        class="flex flex-col items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      >
        <p class="flex gap-2">
          <InfoIcon class="mt-0.5 size-4 shrink-0" />{{ t('dns.diagnostics.changed') }}
        </p>
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline', class: LONG })"
          :disabled="running"
          @click="runAgain"
        >
          {{ t('dns.diagnostics.run.again') }}
        </button>
      </div>

      <DiagnosticsSummary v-model:only-attention="onlyAttention" :checks="result.checks" />
      <DiagnosticsServerFacts :result="result" />
      <DnsCheckMessages v-if="resultNotes.length > 0" data-result-notes :messages="resultNotes" />

      <section
        v-if="result.serverChecksIncluded && serverChecks.length > 0"
        aria-labelledby="checks-server-title"
        class="flex flex-col gap-3"
      >
        <h2 id="checks-server-title" class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('dns.diagnostics.scopes.server') }}
        </h2>
        <DnsCheckList :checks="serverChecks" :title="t('dns.diagnostics.scopes.server')" />
      </section>
      <section aria-labelledby="checks-name-title" class="flex flex-col gap-3">
        <h2 id="checks-name-title" class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('dns.diagnostics.scopes.domain') }}
        </h2>
        <DnsCheckList
          v-if="nameChecks.length > 0"
          :checks="nameChecks"
          :title="t('dns.diagnostics.scopes.domain')"
        />
        <p v-else class="text-sm text-gray-700 dark:text-gray-300">
          {{ t('dns.diagnostics.summary.noneLeft') }}
        </p>
      </section>

      <DiagnosticsZoneFile :name="result.name" :zone-file="result.zoneFile" />
      <LegacyText
        k="diagnostics.dns_records_docs"
        as="p"
        class="text-sm text-gray-700 dark:text-gray-300"
      />
    </template>
  </article>
</template>
