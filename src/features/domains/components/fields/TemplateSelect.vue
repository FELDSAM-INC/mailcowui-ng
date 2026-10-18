<script setup lang="ts">
// The template choice of the classic add domain form (FR-019, `js/site/mailbox.js`): the
// templates by name, the Default template first.
import type { DomainTemplate } from '@/api'
import FormField from '@/shared/components/FormField.vue'

import { orderTemplates } from '../../create-form'

withDefaults(
  defineProps<{
    id: string
    label: string
    modelValue: number | null
    templates: readonly Pick<DomainTemplate, 'id' | 'name' | 'isDefault'>[]
    errors?: readonly string[]
  }>(),
  { errors: () => [] },
)
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
</script>

<template>
  <FormField :id="id" :label="label" :errors="errors">
    <template #default="control">
      <select
        v-bind="control"
        :value="modelValue === null ? '' : String(modelValue)"
        class="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        @change="emit('update:modelValue', Number(($event.target as HTMLSelectElement).value))"
      >
        <option
          v-for="template in orderTemplates(templates)"
          :key="template.id"
          :value="String(template.id)"
        >
          {{ template.name }}
        </option>
      </select>
    </template>
  </FormField>
</template>
