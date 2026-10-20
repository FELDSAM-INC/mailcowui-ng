<script setup lang="ts">
// The expiry of a new key (FR-065): never (preselected), 30, 90 or 365 days from now, or a specific
// date and time in the device's time zone, which must lie in the future.
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import FormField from '@/shared/components/FormField.vue'

import { EXPIRY_CHOICES, localInputValue, type ExpiryChoice } from '../expiry'

export interface ExpiryValue {
  choice: ExpiryChoice
  custom: string
}

const props = defineProps<{
  modelValue: ExpiryValue
  groupId: string
  customId: string
  labelledBy: string
  errors: readonly string[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: ExpiryValue] }>()
const { t } = useI18n()
const name = useId()
const errorId = useId()
const min = computed(() => localInputValue(new Date()))
const custom = computed(() => props.modelValue.choice === 'custom')
const groupErrors = computed(() => (custom.value ? [] : props.errors))

const LABELS: Record<ExpiryChoice, string> = {
  never: 'apiKeys.expiry.never',
  '30': 'apiKeys.expiry.days30',
  '90': 'apiKeys.expiry.days90',
  '365': 'apiKeys.expiry.days365',
  custom: 'apiKeys.expiry.custom',
}

function choose(choice: ExpiryChoice) {
  emit('update:modelValue', { ...props.modelValue, choice })
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div
      :id="groupId"
      role="radiogroup"
      tabindex="-1"
      :aria-labelledby="labelledBy"
      :aria-describedby="groupErrors.length > 0 ? errorId : undefined"
      class="flex flex-col focus:outline-none"
    >
      <label
        v-for="choice in EXPIRY_CHOICES"
        :key="choice"
        class="flex min-h-11 items-center gap-3 text-gray-800 dark:text-gray-200"
      >
        <input
          type="radio"
          :name="name"
          :value="choice"
          :checked="modelValue.choice === choice"
          class="size-5 accent-accent"
          @change="choose(choice)"
        />
        {{ t(LABELS[choice]) }}
      </label>
    </div>
    <p
      v-for="(message, index) in groupErrors"
      :id="errorId"
      :key="index"
      class="text-sm text-red-700 dark:text-red-300"
    >
      {{ message }}
    </p>
    <FormField
      v-if="custom"
      :id="customId"
      v-slot="field"
      :label="t('apiKeys.expiry.customLabel')"
      :errors="errors"
    >
      <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- labelled by FormField (for/id) -->
      <input
        v-bind="field"
        :value="modelValue.custom"
        type="datetime-local"
        :min="min"
        class="form-control"
        @input="
          emit('update:modelValue', {
            ...modelValue,
            custom: ($event.target as HTMLInputElement).value,
          })
        "
      />
    </FormField>
  </div>
</template>
