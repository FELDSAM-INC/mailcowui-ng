<script setup lang="ts">
// One labelled text row of the classic identity provider form: legacy's label, its help text when
// legacy has one (a tooltip there, visible here, FR-074), placeholder and `required`.
import FormField from '@/shared/components/FormField.vue'

import { INPUT } from './styles'

withDefaults(
  defineProps<{
    id: string
    label: string
    modelValue: string
    required?: boolean
    description?: string
    placeholder?: string
    type?: 'text' | 'url' | 'number'
    min?: number
    max?: number
    errors?: readonly string[]
  }>(),
  {
    required: false,
    description: undefined,
    placeholder: undefined,
    type: 'text',
    min: undefined,
    max: undefined,
    errors: () => [],
  },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <FormField
    :id="id"
    :label="label"
    :required="required"
    :description="description"
    :errors="errors"
  >
    <template #default="control">
      <input
        v-bind="control"
        :value="modelValue"
        :type="type"
        :inputmode="type === 'number' ? 'numeric' : type === 'url' ? 'url' : undefined"
        :min="min"
        :max="max"
        :placeholder="placeholder"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        :class="INPUT"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </template>
  </FormField>
</template>
