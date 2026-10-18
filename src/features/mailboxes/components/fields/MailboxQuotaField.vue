<script setup lang="ts">
// The quota as the classic forms enter it: MiB, with "0 = ∞" under the field and legacy's
// "max. … MiB" badge under the label (hard-coded in legacy). Before a domain is chosen on the add
// form, the field is disabled with "Please select a domain first"; when the domain has no quota
// left, legacy's warning is shown and the quota stays at 0 (unlimited), as legacy disables it.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt, type LegacyKey } from '@/i18n'
import { useFormat } from '@/i18n/format'
import FormField from '@/shared/components/FormField.vue'

import { MIB } from '../../quota'

const props = withDefaults(
  defineProps<{
    id: string
    labelKey: LegacyKey
    modelValue: string
    /** The largest quota in bytes; null shows no badge. */
    max?: number | null
    /** The add form before a domain is chosen. */
    awaitingDomain?: boolean
    /** The domain has no quota left: only unlimited mailboxes. */
    exhausted?: boolean
    errors?: readonly string[]
  }>(),
  { max: null, awaitingDomain: false, exhausted: false, errors: () => [] },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useI18n()
const fmt = useFormat()
const badge = computed(() =>
  props.max === null
    ? null
    : t('mailboxes.quota.max', { max: fmt.number(Math.floor(props.max / MIB)) }),
)
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <FormField :id="id" :label="lt(labelKey)" :description="badge ?? undefined" :errors="errors">
      <template #default="control">
        <input
          v-bind="control"
          :value="awaitingDomain ? '' : modelValue"
          :placeholder="awaitingDomain ? lt('add.select_domain') : undefined"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          :disabled="awaitingDomain || exhausted"
          :aria-describedby="
            [control['aria-describedby'], `${id}-unlimited`].filter(Boolean).join(' ')
          "
          class="form-control sm:max-w-xs"
          @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        />
      </template>
    </FormField>
    <p :id="`${id}-unlimited`" class="text-sm text-gray-600 dark:text-gray-400">
      {{ t('mailboxes.quota.unlimitedHint') }}
    </p>
    <p
      v-if="exhausted"
      data-quota-exhausted
      role="status"
      class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      {{ lt('warning.quota_exceeded_scope') }}
    </p>
  </div>
</template>
