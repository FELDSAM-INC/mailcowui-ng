<script setup lang="ts">
// The DNS record of a DKIM key (research R7, FR-016 to FR-018): the record name, the host label
// inside the zone and the value, each with a copy button that names what it copies; the value as
// one text or split into quoted 255-character pieces, one form at a time, and the copy follows the
// form shown. A key without a record says that nothing can be published until it is complete.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DkimKey } from '@/api'
import { lt } from '@/i18n'
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group'

import { recordView } from '../dkim/record'
import RecordValue from './RecordValue.vue'

const props = withDefaults(defineProps<{ entry: DkimKey; headingLevel?: 2 | 3 }>(), {
  headingLevel: 2,
})
const { t } = useI18n()
const view = computed(() => recordView(props.entry.key))
const form = ref<'single' | 'split'>('single')
const id = computed(() => `dkim-record-${props.entry.name.replace(/[^A-Za-z0-9_-]/g, '_')}`)
</script>

<template>
  <section data-dkim-record :aria-labelledby="`${id}-title`" class="flex flex-col gap-3">
    <component
      :is="`h${headingLevel}`"
      :id="`${id}-title`"
      tabindex="-1"
      class="text-lg font-semibold text-gray-900 focus:outline-none dark:text-white"
    >
      {{ t('dns.dkim.record.title') }}
    </component>
    <p v-if="!view" class="text-sm text-gray-700 dark:text-gray-300">
      {{ t('dns.dkim.record.none') }}
    </p>
    <template v-else>
      <RecordValue
        :label="lt('diagnostics.dns_records_name')"
        :value="view.name"
        :copy-label="t('dns.dkim.record.copyName', { name: entry.displayName })"
      />
      <RecordValue
        :label="t('dns.dkim.record.hostLabel')"
        :value="view.hostLabel"
        :copy-label="t('dns.dkim.record.copyHost', { name: entry.displayName })"
      />
      <p class="text-sm text-gray-700 dark:text-gray-300">
        {{ lt('diagnostics.dns_records_type') }}: <code class="font-mono">TXT</code>
      </p>
      <fieldset class="flex flex-col gap-2">
        <legend class="text-sm font-medium text-gray-800 dark:text-gray-200">
          {{ t('dns.dkim.record.form') }}
        </legend>
        <RadioGroup v-model="form" class="flex flex-col gap-2 sm:flex-row sm:gap-6">
          <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -- the radio is inside -->
          <label
            v-for="option in ['single', 'split'] as const"
            :key="option"
            class="inline-flex min-h-11 items-center gap-2 text-sm text-gray-800 dark:text-gray-200"
          >
            <RadioGroupItem :value="option" />
            {{ t(`dns.dkim.record.${option}`) }}
          </label>
        </RadioGroup>
      </fieldset>
      <div :data-record-form="form" class="contents">
        <RecordValue
          :label="t('dns.dkim.record.value')"
          :value="form === 'single' ? view.value : view.split"
          :copy-label="t('dns.dkim.record.copyValue', { name: entry.displayName })"
        />
      </div>
    </template>
  </section>
</template>
