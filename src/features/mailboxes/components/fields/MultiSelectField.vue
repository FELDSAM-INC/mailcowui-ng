<script setup lang="ts">
// A multi-select of the classic forms (allowed protocols, ACL): a native `<select multiple>` with
// the options in legacy order. Locked by the caller's flags, the chosen options are listed as text
// with "Prohibited by ACL" and the permission, as legacy's `data-acl="0"` controls.
import { computed } from 'vue'

import type { PermissionFlags } from '@/api'
import FormField from '@/shared/components/FormField.vue'

import AclReadOnlyNote from './AclReadOnlyNote.vue'

const props = withDefaults(
  defineProps<{
    id: string
    label: string
    options: readonly { value: string; label: string }[]
    modelValue: readonly string[]
    errors?: readonly string[]
    lockedBy?: keyof PermissionFlags | null
    size?: number
  }>(),
  { errors: () => [], lockedBy: null, size: undefined },
)
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const chosen = computed(() =>
  props.options.filter((option) => props.modelValue.includes(option.value)),
)

function onChange(event: Event) {
  emit(
    'update:modelValue',
    [...(event.target as HTMLSelectElement).selectedOptions].map((option) => option.value),
  )
}
</script>

<template>
  <div v-if="lockedBy" class="flex flex-col gap-1.5" :data-locked="id">
    <p :id="`${id}-label`" class="text-sm font-medium text-gray-800 dark:text-gray-200">
      {{ label }}
    </p>
    <ul
      :aria-labelledby="`${id}-label`"
      class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-900 dark:text-white"
    >
      <li v-for="option in chosen" :key="option.value">{{ option.label }}</li>
    </ul>
    <AclReadOnlyNote :id="`${id}-acl`" :flag="lockedBy" />
  </div>
  <FormField v-else :id="id" :label="label" :errors="errors">
    <template #default="control">
      <select
        v-bind="control"
        multiple
        :size="size ?? options.length"
        class="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        @change="onChange"
      >
        <option
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          :selected="modelValue.includes(option.value)"
          class="px-1 py-1"
        >
          {{ option.label }}
        </option>
      </select>
    </template>
  </FormField>
</template>
