<script setup lang="ts">
// "Kind" as the classic resource forms ask for it (`add.kind`, `edit.kind`): legacy's select of
// Location, Group and Thing in legacy's order (hard-coded English in legacy, new strings here), with
// legacy's "Please select..." until one is chosen on the add form.
import { useI18n } from 'vue-i18n'

import type { ResourceKind } from '@/api'
import { lt, type LegacyKey } from '@/i18n'

withDefaults(
  defineProps<{
    id: string
    labelKey: LegacyKey
    modelValue: ResourceKind | ''
    errors?: readonly string[]
  }>(),
  { errors: () => [] },
)
const emit = defineEmits<{ 'update:modelValue': [value: ResourceKind] }>()
const { t } = useI18n()
const KINDS: ResourceKind[] = ['location', 'group', 'thing']
const SELECT =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white'
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label :for="id" class="text-sm font-medium text-gray-800 dark:text-gray-200">
      {{ lt(labelKey) }}
    </label>
    <select
      :id="id"
      :value="modelValue"
      :class="SELECT"
      :aria-invalid="errors.length > 0 ? 'true' : undefined"
      :aria-describedby="errors.length > 0 ? `${id}-error` : undefined"
      @change="
        emit('update:modelValue', ($event.target as HTMLSelectElement).value as ResourceKind)
      "
    >
      <option v-if="modelValue === ''" value="" disabled>{{ lt('add.select') }}</option>
      <option v-for="kind in KINDS" :key="kind" :value="kind">
        {{ t(`enums.resourceKind.${kind}`) }}
      </option>
    </select>
    <div
      v-if="errors.length > 0"
      :id="`${id}-error`"
      class="text-sm text-red-700 dark:text-red-300"
    >
      <p v-for="message in errors" :key="message">{{ message }}</p>
    </div>
  </div>
</template>
