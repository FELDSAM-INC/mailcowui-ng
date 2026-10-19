<script setup lang="ts">
// The DKIM block of the domain page (legacy `templates/edit/domain.twig`, below the "Edit domain"
// form) and of the alias domain page (FR-021, research R19). Legacy shows "Domain: name
// (selector._domainkey)" and the TXT value; the section adds the key's state and length, the copy
// buttons, the link to the entry, "Add ARC/DKIM key" for a name without a key (US2) and, on the
// domain page, the DKIM keys of the domain and its alias domains (FR-012). It reads the same detail
// key as the entry page, so a change anywhere shows here at once (FR-089).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { problemOf } from '@/api'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { buttonVariants } from '@/shared/ui/button'

import { useDkimKey } from '../api/dkim'
import { useDnsRole } from '../composables/useDnsRole'
import { dkimKeyLocation, dkimListLocation } from '../names'
import DkimStateBadge from './DkimStateBadge.vue'
import IncompleteKeyNotice from './IncompleteKeyNotice.vue'
import RecordValue from './RecordValue.vue'

const props = defineProps<{ name: string; kind: 'domain' | 'aliasDomain' }>()
const { t, locale } = useI18n()
const { role } = useDnsRole()
const query = useDkimKey(() => props.name)
const entry = computed(() => query.data.value)
const key = computed(() => entry.value?.key ?? null)
/** Long labels wrap instead of widening the page at 320 px. */
const LONG = 'h-auto min-h-11 max-w-full shrink whitespace-normal text-start'
</script>

<template>
  <section
    id="section-dkim"
    data-dkim-section
    aria-labelledby="section-dkim-title"
    class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
  >
    <h2 id="section-dkim-title" class="text-lg font-semibold text-gray-900 dark:text-white">
      {{ lt('admin.dkim_keys') }}
    </h2>
    <p v-if="query.isPending.value" class="mt-3 text-sm text-gray-600 dark:text-gray-400">
      {{ lt('datatables.loadingRecords') }}
    </p>
    <div v-else-if="!entry" class="mt-3">
      <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="query.refetch()" />
    </div>
    <div v-else class="mt-3 flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <DkimStateBadge :entry="entry" />
      </div>
      <p v-if="!key" class="text-sm text-gray-700 dark:text-gray-300">
        {{ t('dns.dkim.entry.notSigned') }}
      </p>
      <template v-else>
        <p class="text-sm break-all text-gray-800 dark:text-gray-200">
          {{ lt('add.domain') }}: <strong>{{ entry.name }}</strong>
          <template v-if="key.selector"> ({{ key.selector }}._domainkey)</template>
        </p>
        <p v-if="key.keyLength !== null" class="text-sm text-gray-700 dark:text-gray-300">
          {{ lt('admin.dkim_key_length') }}:
          {{ formatNumber(key.keyLength, locale as AppLocale) }}
        </p>
        <IncompleteKeyNotice :entry="entry" :role="role" />
        <RecordValue
          v-if="key.record"
          :label="t('dns.dkim.record.value')"
          :value="key.record.value"
          :copy-label="t('dns.dkim.record.copyValue', { name: entry.displayName })"
        />
      </template>
      <div class="flex flex-wrap gap-2">
        <slot name="actions" :entry="entry" />
        <RouterLink
          :to="dkimKeyLocation(entry.name)"
          :class="buttonVariants({ variant: 'outline', class: LONG })"
        >
          {{ t('dns.dkim.section.open') }}
        </RouterLink>
        <RouterLink
          v-if="kind === 'domain'"
          :to="dkimListLocation({ domain: entry.name })"
          :class="buttonVariants({ variant: 'outline', class: LONG })"
        >
          {{ t('dns.dkim.section.list') }}
        </RouterLink>
      </div>
    </div>
  </section>
</template>
