<script setup lang="ts">
// The shared multiselect of allowed protocols and ACL, with options in legacy order. Locked by the caller's flags, the chosen options are listed as text
// with "Prohibited by ACL" and the permission, as legacy's `data-acl="0"` controls.
import { computed } from 'vue'

import type { PermissionFlags } from '@/api'
import MultiSelect from '@/shared/components/MultiSelect.vue'

import AclReadOnlyNote from '@/shared/components/AclReadOnlyNote.vue'

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
  <MultiSelect
    v-else
    :id="id"
    :label="label"
    :errors="errors"
    :model-value="modelValue"
    :options="options"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
