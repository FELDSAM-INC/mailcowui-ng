<script setup lang="ts">
// The template choice of the classic add domain and add mailbox forms (`js/site/mailbox.js`): the
// templates by name, the Default template first. Promoted from UI 002 at its second use (UI 003).
import FormField from './FormField.vue'

interface TemplateOption {
  id: number
  name: string
  isDefault: boolean
}

const ordered = (templates: readonly TemplateOption[]) => [
  ...templates.filter((item) => item.isDefault),
  ...templates.filter((item) => !item.isDefault),
]

withDefaults(
  defineProps<{
    id: string
    label: string
    modelValue: number | null
    templates: readonly TemplateOption[]
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
          v-for="template in ordered(templates)"
          :key="template.id"
          :value="String(template.id)"
        >
          {{ template.name }}
        </option>
      </select>
    </template>
  </FormField>
</template>
