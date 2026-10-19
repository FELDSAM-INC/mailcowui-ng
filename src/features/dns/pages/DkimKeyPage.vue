<script setup lang="ts">
// A DKIM entry (US1, FR-016 to FR-020): its readable name as the heading, the facts, the DNS record
// with its copy buttons, "not signed" for a name without a key, the incomplete notice, and the
// actions the role and the server allow (later stories add them). An unknown name, or one outside
// the scope, shows the not-found page with a way back (FR-004).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { isApiProblem, problemOf } from '@/api'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { lt } from '@/i18n'
import DomainNameText from '@/shared/components/DomainNameText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'

import { useDnsCapabilities } from '../api/capabilities'
import { useDkimKey } from '../api/dkim'
import DkimKeyFacts from '../components/DkimKeyFacts.vue'
import DkimRecord from '../components/DkimRecord.vue'
import IncompleteKeyNotice from '../components/IncompleteKeyNotice.vue'
import { useDnsRole } from '../composables/useDnsRole'
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
        <slot name="actions" :entry="entry" :actions="actions" />
      </div>
    </header>
    <p
      v-if="gone"
      role="alert"
      class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      {{ t('dns.common.gone') }}
    </p>
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
  </article>
</template>
