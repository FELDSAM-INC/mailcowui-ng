<script setup lang="ts">
// The name of a new domain, as the classic add domain form asks for it (owner rule 1:1): "Domain",
// required, without auto-capitalisation or auto-correction. A name that is not a valid domain is
// named with legacy's `danger.domain_invalid` when the field is left (FR-020).
import { computed, ref } from 'vue'
import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'

import { isValidDomainName } from '../../domain-name'

const props = withDefaults(
  defineProps<{ id: string; modelValue: string; label: string; errors?: readonly string[] }>(),
  { errors: () => [] },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const touched = ref(false)

const localError = computed(() =>
  touched.value && props.modelValue.trim() !== '' && !isValidDomainName(props.modelValue)
    ? [lt('danger.domain_invalid')]
    : [],
)
const allErrors = computed(() => (props.errors.length > 0 ? props.errors : localError.value))

function onInput(event: Event) {
  touched.value = false
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <FormField :id="id" :label="label" :errors="allErrors" required>
    <template #default="control">
      <input
        v-bind="control"
        :value="modelValue"
        type="text"
        inputmode="url"
        autocomplete="off"
        autocapitalize="none"
        autocorrect="off"
        spellcheck="false"
        maxlength="255"
        class="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        @input="onInput"
        @blur="touched = true"
      />
    </template>
  </FormField>
</template>
