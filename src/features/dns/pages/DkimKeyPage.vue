<script setup lang="ts">
// A DKIM entry (US1, FR-016 to FR-020): its readable name as the heading, the facts, the DNS record
// with its copy buttons, "not signed" for a name without a key, the incomplete notice, and the
// actions the role and the server allow (FR-002): "Add ARC/DKIM key" (US2), "Replace with a new
// key", import with overwrite, "Duplicate" and "Remove" (US5), the private key export or the note
// that it is turned off (US6), "Publish DNS record again" (US7), History (US8) and "DNS" (US3). An
// unknown name, or one outside the scope, shows the not-found page with a way back (FR-004).
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, nextTick, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import { isApiProblem, problemOf, queryKeys, type DkimDnsPublicationOutcome } from '@/api'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { lt } from '@/i18n'
import DomainNameText from '@/shared/components/DomainNameText.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { CheckIcon, InfoIcon, TrashIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { useDnsCapabilities } from '../api/capabilities'
import { useDkimKey } from '../api/dkim'
import CheckDnsAction from '../components/CheckDnsAction.vue'
import DkimKeyFacts from '../components/DkimKeyFacts.vue'
import DkimRecord from '../components/DkimRecord.vue'
import ExportPrivateKeyAction from '../components/ExportPrivateKeyAction.vue'
import IncompleteKeyNotice from '../components/IncompleteKeyNotice.vue'
import PublishAgainAction from '../components/PublishAgainAction.vue'
import ReplaceKeyDialog from '../components/ReplaceKeyDialog.vue'
import PublicationOutcome from '../components/PublicationOutcome.vue'
import GenerateKeyDialog from '../components/GenerateKeyDialog.vue'
import { useSingleGeneration } from '../composables/useDkimGeneration'
import { useDnsRole } from '../composables/useDnsRole'
import { useKeyActions } from '../composables/useKeyActions'
import { dkimCopyLocation, dkimImportLocation } from '../names'
import { dkimActions } from '../permissions'

const { t } = useI18n()
const route = useRoute()
const { role } = useDnsRole()
const capabilities = useDnsCapabilities()
const name = computed(() => String(route.params.dkimName ?? ''))
const query = useDkimKey(name)
const entry = computed(() => query.data.value)
const notFound = computed(
  () => !entry.value && isApiProblem(query.error.value) && query.error.value.status === 404,
)
const gone = computed(
  () => !!entry.value && isApiProblem(query.error.value) && query.error.value.status === 404,
)
const actions = computed(() =>
  entry.value && role.value ? dkimActions(entry.value, role.value, capabilities.data.value) : null,
)

// US5: replacement and deletion, with their outcome as an inline status.
const keyActions = useKeyActions({
  entry,
  publication: () => capabilities.data.value?.dkim.dnsPublicationEnabled ?? false,
})

// The publication outcome of the last change of this name (US2, US5, US7), shown once.
const queryClient = useQueryClient()
const outcomeKey = computed(() => queryKeys.dkimKeys.outcome(name.value))
const outcome = useQuery(
  computed(() => ({
    queryKey: outcomeKey.value,
    queryFn: () => null as DkimDnsPublicationOutcome | null,
    enabled: false,
    staleTime: Infinity,
  })),
)
function dismissOutcome() {
  queryClient.removeQueries({ queryKey: outcomeKey.value, exact: true })
}
onBeforeUnmount(dismissOutcome)

// US2: "Add ARC/DKIM key" for a name without a key; afterwards the record heading takes the focus.
const generation = useSingleGeneration(async () => {
  await nextTick()
  document.querySelector<HTMLElement>('[data-dkim-record] h2')?.focus()
})
</script>

<template>
  <NotFoundPage v-if="notFound" :back-to="{ name: 'dkim-keys' }" :back-label="t('common.back')" />
  <div
    v-else-if="!entry && query.isPending.value"
    data-page-loading
    role="status"
    aria-busy="true"
    class="mx-auto w-full max-w-5xl"
  >
    <p class="text-gray-600 dark:text-gray-400">{{ lt('datatables.loadingRecords') }}</p>
  </div>
  <section v-else-if="!entry" class="mx-auto flex w-full max-w-5xl flex-col gap-3">
    <h1
      tabindex="-1"
      class="text-2xl font-semibold text-gray-900 focus:outline-none dark:text-white"
    >
      {{ lt('admin.dkim_keys') }}
    </h1>
    <p role="alert" class="font-medium text-gray-900 dark:text-white">
      {{ t('dns.dkim.entry.loadFailed') }}
    </p>
    <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="query.refetch()" />
  </section>
  <article v-else class="mx-auto flex w-full max-w-5xl flex-col gap-4">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <p class="text-sm text-gray-600 dark:text-gray-400">{{ lt('admin.dkim_keys') }}</p>
        <!-- eslint-disable-next-line vuejs-accessibility/heading-has-content -- the name is its content -->
        <h1
          tabindex="-1"
          class="text-2xl font-semibold text-gray-900 focus:outline-none dark:text-white"
        >
          <DomainNameText :name="entry.name" :unicode-name="entry.displayName" />
        </h1>
      </div>
      <div data-entry-actions class="flex flex-wrap gap-2">
        <button
          v-if="actions?.replace"
          type="button"
          data-replace
          :class="buttonVariants({ variant: 'outline' })"
          :disabled="!capabilities.data.value || keyActions.pending.value"
          @click="keyActions.replaceOpen.value = true"
        >
          {{ t('dns.dkim.replace.action') }}
        </button>
        <RouterLink
          v-if="actions?.importOverwrite"
          :to="dkimImportLocation(entry.name)"
          :class="buttonVariants({ variant: 'outline' })"
        >
          {{ lt('admin.import_private_key') }}
        </RouterLink>
        <RouterLink
          v-if="actions?.copyKey"
          :to="dkimCopyLocation(entry.name)"
          :class="buttonVariants({ variant: 'outline' })"
        >
          {{ lt('admin.duplicate') }}
        </RouterLink>
        <ExportPrivateKeyAction v-if="actions?.export" :entry="entry" />
        <PublishAgainAction v-if="actions?.publishAgain" :entry="entry" :show-outcome="false" />
        <HistoryLink v-if="actions?.history" target-type="dkimKey" :target-id="entry.name" />
        <button
          v-if="actions?.delete"
          type="button"
          data-delete
          :class="buttonVariants({ variant: 'destructive' })"
          :disabled="keyActions.pending.value"
          @click="keyActions.remove"
        >
          <TrashIcon />
          {{ lt('admin.remove') }}
        </button>
        <button
          v-if="actions?.generate"
          type="button"
          data-generate
          :class="buttonVariants({ variant: 'default' })"
          :disabled="!capabilities.data.value"
          @click="generation.start({ name: entry.name, label: entry.displayName })"
        >
          {{ lt('admin.dkim_add_key') }}
        </button>
        <CheckDnsAction v-if="actions?.checkDns" :name="entry.name" />
      </div>
    </header>
    <div
      v-if="keyActions.status.value"
      :role="keyActions.status.value.kind === 'error' ? 'alert' : 'status'"
      data-entry-status
      class="flex gap-2 rounded-xl border p-3 text-sm"
      :class="
        keyActions.status.value.kind === 'error'
          ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
          : 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200'
      "
    >
      <CheckIcon v-if="keyActions.status.value.kind === 'success'" class="mt-0.5 size-4 shrink-0" />
      <InfoIcon v-else class="mt-0.5 size-4 shrink-0" />
      <div class="flex flex-col gap-1">
        <p class="break-words">{{ keyActions.status.value.message }}</p>
        <p v-if="keyActions.updateRecordNote.value">{{ t('dns.dkim.replace.updateRecord') }}</p>
      </div>
    </div>
    <ProblemMessage
      v-if="keyActions.problem.value"
      :problem="keyActions.problem.value"
      :params="{ name: entry.name }"
    />
    <p
      v-if="actions?.exportOffNote"
      data-export-off
      class="text-sm text-gray-700 dark:text-gray-300"
    >
      {{ t('dns.dkim.export.off') }}
    </p>
    <p
      v-if="gone"
      role="alert"
      class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      {{ t('dns.common.gone') }}
    </p>
    <div
      v-if="outcome.data.value && capabilities.data.value?.dkim.dnsPublicationEnabled"
      data-entry-outcome
      class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
    >
      <PublicationOutcome
        :outcome="outcome.data.value"
        :enabled="capabilities.data.value.dkim.dnsPublicationEnabled"
      >
        <template #action>
          <PublishAgainAction v-if="actions?.publishAgain" :entry="entry" :show-outcome="false" />
        </template>
      </PublicationOutcome>
    </div>
    <section
      class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
    >
      <DkimKeyFacts :entry="entry" />
    </section>
    <IncompleteKeyNotice :entry="entry" :role="role" />
    <section
      class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
    >
      <p v-if="!entry.key" data-not-signed class="text-gray-800 dark:text-gray-200">
        {{ t('dns.dkim.entry.notSigned') }}
      </p>
      <DkimRecord v-else :entry="entry" />
    </section>
    <ReplaceKeyDialog
      v-if="capabilities.data.value && entry.key"
      v-model:open="keyActions.replaceOpen.value"
      :entry="entry"
      :caps="capabilities.data.value"
      :pending="keyActions.pending.value"
      @submit="keyActions.replace"
    />
    <GenerateKeyDialog
      v-if="capabilities.data.value"
      v-model:open="generation.open.value"
      :names="generation.names.value"
      :caps="capabilities.data.value"
      :pending="generation.pending.value"
      :problem="generation.problem.value"
      @submit="generation.submit"
    />
  </article>
</template>
