<script setup lang="ts">
// A mailbox or alias limit: a whole number with a numeric keypad (FR-070) and the number in use
// next to it (FR-031).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFormat } from '@/i18n/format'
import FormField from '@/shared/components/FormField.vue'

const props = withDefaults(
  defineProps<{
    id: string
    label: string
    modelValue: string
    inUse?: number | null
    description?: string
    errors?: readonly string[]
  }>(),
  { inUse: null, description: undefined, errors: () => [] },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useI18n()
const fmt = useFormat()

const hint = computed(() =>
  [
    props.description,
    props.inUse !== null
      ? t('domains.fields.inUseCount', { count: fmt.number(props.inUse) })
      : undefined,
  ]
    .filter(Boolean)
    .join(' '),
)
</script>

<template>
  <FormField :id="id" :label="label" :description="hint || undefined" :errors="errors">
    <template #default="control">
      <input
        v-bind="control"
        :value="modelValue"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        autocomplete="off"
        class="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-500 sm:max-w-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </template>
  </FormField>
</template>
