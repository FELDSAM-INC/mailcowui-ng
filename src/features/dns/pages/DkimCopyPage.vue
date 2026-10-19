<script setup lang="ts">
// Copying a DKIM key to other names (US5, FR-034 to FR-036; legacy's "Duplicate DKIM record" form,
// as a page): "From" is this entry, with its selector and length; "To" is UI 004's shared domain
// picker over the domains and alias domains (never the source), and every chosen target that has a
// key is marked with its selector. Targets with a key are overwritten only after one confirmation
// that lists them, with their version tags. One request per target (UI 004's runner), with the
// classic `success.dkim_duplicated` per target and the publication outcomes; leaving during the run
// asks first. A source whose key is incomplete cannot be copied.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { isApiProblem, problemOf, type DkimKey, type DkimKeyChangeResult } from '@/api'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import DomainNameText from '@/shared/components/DomainNameText.vue'
import DomainPicker from '@/shared/components/DomainPicker.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { confirm } from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useSequentialCreate } from '@/shared/composables/useSequentialCreate'
import { useStickyBarFocus } from '@/shared/composables/useStickyBarFocus'
import { buttonVariants } from '@/shared/ui/button'

import { useDnsCapabilities } from '../api/capabilities'
import { copyKey, useDkimKey } from '../api/dkim'
import PublishAgainAction from '../components/PublishAgainAction.vue'
import RunDialog from '../components/RunDialog.vue'
import { copyTargetSource } from '../dkim/copy-targets'
import { dkimRunClassifier, runRows, type RunRow } from '../dkim/generate-run'
import { dkimKeyLocation } from '../names'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const client = useQueryClient()
const capabilities = useDnsCapabilities()
useStickyBarFocus()

const sourceName = computed(() => String(route.params.dkimName ?? ''))
const query = useDkimKey(sourceName)
const source = computed(() => query.data.value)
const notFound = computed(
  () =>
    (!source.value && isApiProblem(query.error.value) && query.error.value.status === 404) ||
    (!!source.value && source.value.key === null),
)
const incomplete = computed(() => !!source.value?.key && !source.value.key.complete)

const known = new Map<string, DkimKey>()
const pickerSource = copyTargetSource(sourceName.value, (entries) => {
  for (const entry of entries) known.set(entry.name, entry)
})
const targets = ref<string[]>([])
const targetError = ref<string[]>([])
const chosen = computed(() => targets.value.map((name) => known.get(name)))
const withKey = computed(() =>
  chosen.value.filter((entry): entry is DkimKey => !!entry?.key && !!entry.etag),
)

const runner = useSequentialCreate<DkimKeyChangeResult>()
const rows = shallowRef<RunRow[]>([])
const runOpen = ref(false)

async function copy(names: readonly string[]) {
  const overwriting = names
    .map((name) => known.get(name))
    .filter((entry): entry is DkimKey => !!entry?.key && !!entry.etag)
  let send = [...names]
  if (overwriting.length > 0) {
    const go = await confirm({
      title: lt('admin.duplicate_dkim'),
      description: t('dns.dkim.copy.confirmOverwrite', {
        names: overwriting.map((entry) => entry.displayName).join(', '),
      }),
      confirmLabel: lt('admin.duplicate'),
      cancelLabel: t('dns.dkim.copy.skipOverwrite'),
      destructive: true,
    })
    if (!go) send = send.filter((name) => !overwriting.some((entry) => entry.name === name))
  }
  if (send.length === 0) return
  runOpen.value = true
  rows.value = []
  const results = await runner.run(
    send.map((value, index) => ({ value, index })),
    (entry) => {
      const target = known.get(entry.value)
      const overwrite =
        target?.key && target.etag && overwriting.some((item) => item.name === entry.value)
          ? { ifMatch: target.etag }
          : null
      return copyKey(client, sourceName.value, entry.value, overwrite)
    },
    dkimRunClassifier,
  )
  rows.value = runRows(results, [], (name) => known.get(name)?.displayName ?? name)
}

function submit(event: Event) {
  event.preventDefault()
  if (runner.running.value) return
  targetError.value = targets.value.length === 0 ? [t('validation.required')] : []
  if (targetError.value.length > 0) {
    document.getElementById('dkim-copy-targets')?.focus()
    return
  }
  void copy(targets.value)
}

const guard = useLeaveGuard(() => runner.running.value, {
  titleKey: 'dns.dkim.run.leaveTitle',
  messageKey: 'dns.dkim.run.leaveBody',
  leaveKey: 'dns.dkim.run.leave',
})
void guard
onBeforeUnmount(() => runner.stop())

const number = (value: number | null | undefined) =>
  value ? formatNumber(value, locale.value as AppLocale) : '–'
</script>

<template>
  <NotFoundPage v-if="notFound" :back-to="{ name: 'dkim-keys' }" :back-label="t('common.back')" />
  <p
    v-else-if="!source && query.isPending.value"
    role="status"
    class="mx-auto w-full max-w-3xl text-gray-600 dark:text-gray-400"
  >
    {{ lt('datatables.loadingRecords') }}
  </p>
  <section v-else-if="!source" class="mx-auto flex w-full max-w-3xl flex-col gap-3">
    <h1 tabindex="-1" class="text-2xl font-semibold text-gray-900 dark:text-white">
      {{ lt('admin.duplicate_dkim') }}
    </h1>
    <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="query.refetch()" />
  </section>
  <section v-else class="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <PageHeader :title="lt('admin.duplicate_dkim')" />
    <div
      data-copy-source
      class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
    >
      <p class="text-sm font-medium text-gray-800 dark:text-gray-200">
        {{ lt('admin.dkim_from') }}
      </p>
      <p class="text-sm text-gray-600 dark:text-gray-400">{{ lt('admin.dkim_from_title') }}</p>
      <p class="mt-2 font-semibold text-gray-900 dark:text-white">
        <DomainNameText :name="source.name" :unicode-name="source.displayName" />
      </p>
      <p class="text-sm text-gray-700 dark:text-gray-300">
        {{ lt('admin.dkim_domains_selector') }}:
        <span class="font-mono">{{ source.key?.selector ?? '–' }}</span> ·
        {{ lt('admin.dkim_key_length') }}: {{ number(source.key?.keyLength) }}
      </p>
    </div>
    <p
      v-if="incomplete"
      role="alert"
      data-copy-incomplete
      class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      {{ t('dns.dkim.copy.incomplete') }}
    </p>
    <form
      v-else
      data-dkim-copy
      class="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
      novalidate
      @submit="submit"
    >
      <DomainPicker
        id="dkim-copy-targets"
        v-model="targets"
        :label="lt('admin.dkim_to')"
        :description="lt('admin.dkim_to_title')"
        :sources="[pickerSource]"
        multiple
        required
        :errors="targetError"
      />
      <ul v-if="withKey.length > 0" data-copy-has-key class="flex flex-col gap-1 text-sm">
        <li v-for="entry in withKey" :key="entry.name" class="break-all">
          {{
            t('dns.dkim.copy.hasKey', {
              name: entry.displayName,
              selector: entry.key?.selector ?? '–',
            })
          }}
        </li>
      </ul>
      <div
        data-sticky-actions
        class="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-gray-200 bg-white px-4 py-3 sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:p-0 dark:border-gray-800 dark:bg-gray-900"
      >
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          @click="router.push(dkimKeyLocation(source.name))"
        >
          {{ lt('footer.cancel') }}
        </button>
        <button
          type="submit"
          :class="buttonVariants({ variant: 'default' })"
          :disabled="runner.running.value"
        >
          {{ lt('admin.duplicate') }}
        </button>
      </div>
    </form>
    <RunDialog
      v-model:open="runOpen"
      :title="lt('admin.duplicate_dkim')"
      :rows="rows"
      :total="runner.total.value"
      :current="runner.current.value"
      :running="runner.running.value"
      mode="copy"
      :source="source.name"
      :publication="capabilities.data.value?.dkim.dnsPublicationEnabled ?? false"
      :stop-problem="runner.stopProblem.value"
      @stop="runner.stop()"
      @retry="(names) => copy(names)"
    >
      <template #publish-action="{ row }">
        <PublishAgainAction v-if="row.result" :entry="row.result" :show-outcome="false" />
      </template>
    </RunDialog>
  </section>
</template>
