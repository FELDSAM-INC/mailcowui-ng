<script setup lang="ts">
// A button group of radio options of the classic forms (tagged mail, quarantine notification and
// category): the legacy legend, the options with their legacy labels and the legacy help below.
// Read-only (managed by a later feature on the mailbox page), the chosen option is shown as text.
import { computed } from 'vue'
import ChoiceButton from '@/shared/components/ChoiceButton.vue'

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
  <fieldset class="flex min-w-0 flex-col gap-3" :aria-describedby="helpIds">
    <legend class="mb-3 font-semibold text-gray-900 dark:text-white">
      {{ lt(legendKey) }}
    </legend>
    <p v-if="readonly" :data-value="idPrefix" class="text-sm text-gray-900 dark:text-white">
      {{ chosen ? lt(chosen.labelKey) : '' }}
    </p>
    <div v-else class="flex flex-wrap gap-2">
      <ChoiceButton
        v-for="option in options"
        :id="`${idPrefix}-${option.value}`"
        :key="option.value"
        :pressed="modelValue === option.value"
        @click="emit('update:modelValue', option.value)"
        >{{ lt(option.labelKey) }}</ChoiceButton
      >
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
