<script setup lang="ts">
// A button group of radio options of the classic forms (tagged mail, quarantine notification and
// category): the legacy legend, the options with their legacy labels and the legacy help below.
// Read-only (managed by a later feature on the mailbox page), the chosen option is shown as text.
import { computed } from 'vue'

import { lt, type LegacyKey } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'

const props = withDefaults(
  defineProps<{
    idPrefix: string
    legendKey: LegacyKey
    modelValue: string
    options: readonly { value: string; labelKey: LegacyKey }[]
    helpKeys?: readonly LegacyKey[]
    readonly?: boolean
  }>(),
  { helpKeys: () => [], readonly: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const chosen = computed(() => props.options.find((option) => option.value === props.modelValue))
const helpIds = computed(
  () => props.helpKeys.map((_, index) => `${props.idPrefix}-help-${index}`).join(' ') || undefined,
)
</script>

<template>
  <fieldset class="flex min-w-0 flex-col gap-2" :aria-describedby="helpIds">
    <legend class="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
      {{ lt(legendKey) }}
    </legend>
    <p v-if="readonly" :data-value="idPrefix" class="text-sm text-gray-900 dark:text-white">
      {{ chosen ? lt(chosen.labelKey) : '' }}
    </p>
    <div v-else class="flex flex-wrap gap-2">
      <label
        v-for="option in options"
        :key="option.value"
        class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm text-gray-800 has-checked:border-brand-500 has-checked:bg-brand-50 has-checked:text-brand-800 dark:border-gray-700 dark:text-gray-200 dark:has-checked:bg-brand-500/15 dark:has-checked:text-brand-200"
      >
        <input
          :id="`${idPrefix}-${option.value}`"
          type="radio"
          :name="idPrefix"
          :value="option.value"
          :checked="modelValue === option.value"
          class="size-4 accent-brand-500"
          @change="emit('update:modelValue', option.value)"
        />
        {{ lt(option.labelKey) }}
      </label>
    </div>
    <LegacyText
      v-for="(key, index) in helpKeys"
      :id="`${idPrefix}-help-${index}`"
      :key="key"
      :k="key"
      as="p"
      class="text-sm text-gray-600 dark:text-gray-400"
    />
  </fieldset>
</template>
