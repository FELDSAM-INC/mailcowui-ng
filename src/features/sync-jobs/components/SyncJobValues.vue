<script setup lang="ts">
// The stored values in read mode (FR-015, plan legacy form map): the edit page's fields in its
// order with its labels, booleans as legacy's check and cross glyphs, empty text as "-", and the
// password only as "A password is saved." or "No password is saved." (FR-029).
import { useI18n } from 'vue-i18n'

import type { SyncJob } from '@/api'
import { useFormat } from '@/i18n/format'
import LegacyText from '@/shared/components/LegacyText.vue'

import { fieldLabel } from '../field-labels'
import {
  BOOLEAN_FIELDS,
  FIELD_ORDER,
  NUMBER_FIELDS,
  OPTION_NAMES,
  type FormField,
} from '../form-model'
import FieldLabel from './FieldLabel.vue'

defineProps<{ job: SyncJob }>()
const { t } = useI18n()
const fmt = useFormat()

const isBoolean = (field: FormField): field is (typeof BOOLEAN_FIELDS)[number] =>
  (BOOLEAN_FIELDS as readonly string[]).includes(field)
const isNumber = (field: FormField): field is (typeof NUMBER_FIELDS)[number] =>
  (NUMBER_FIELDS as readonly string[]).includes(field)
const CODE_FIELDS = new Set<FormField>(['exclude', 'customParameters'])
</script>

<template>
  <dl
    data-section-values
    class="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
  >
    <div v-for="field in FIELD_ORDER" :key="field" class="flex min-w-0 flex-col gap-0.5">
      <dt class="text-gray-600 dark:text-gray-400">
        <FieldLabel
          :text="fieldLabel('edit', field)"
          :option="isBoolean(field) ? OPTION_NAMES[field] : undefined"
        />
      </dt>
      <dd class="wrap-anywhere text-gray-900 dark:text-white">
        <template v-if="field === 'remotePassword'">
          {{ job.remotePasswordSet ? t('syncJobs.password.saved') : t('syncJobs.password.none') }}
        </template>
        <template v-else-if="field === 'encryption'">
          {{ t(`enums.syncJobEncryption.${job.encryption}`) }}
        </template>
        <LegacyText v-else-if="isBoolean(field)" :k="job[field] ? 'mailbox.yes' : 'mailbox.no'" />
        <template v-else-if="field === 'remotePort'">{{ job.remotePort }}</template>
        <template v-else-if="isNumber(field)">{{ fmt.number(job[field]) }}</template>
        <template v-else-if="job[field] === ''">-</template>
        <code v-else-if="CODE_FIELDS.has(field)">{{ job[field] }}</code>
        <template v-else>{{ job[field] }}</template>
      </dd>
    </div>
  </dl>
</template>
