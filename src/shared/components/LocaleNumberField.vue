<script setup lang="ts">
// A number field typed in the user's locale (UI 006 research R18, FR-074): a text field with a
// numeric or decimal keypad, never `type="number"`, so the app's locale decides the decimal
// separator and an invalid entry says why. Decimal mode works in tenths (6.5 is 65), integer mode in
// whole numbers. A valid entry updates the model; an invalid one keeps the model, shows its reason
// through `FormField` (`danger.object_is_not_numeric` with the typed text, the one-decimal rule, or
// "required") and reports `valid: false`, so that the form blocks its save. The stored value is
// shown in the locale without grouping.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import { isAppLocale, DEFAULT_LOCALE } from '@/i18n/locales'
import {
  formatEditableNumber,
  fromTenths,
  parseLocaleDecimal,
  parseLocaleInteger,
  type NumberParseReason,
} from '@/i18n/parse'

import FormField from './FormField.vue'

const props = withDefaults(
  defineProps<{
    id: string
    label: string
    /** Tenths in decimal mode, a whole number in integer mode; null when empty. */
    modelValue: number | null
    mode?: 'decimal' | 'integer'
    /** An empty entry is valid (null). */
    optional?: boolean
    description?: string
    placeholder?: string
    /** Errors from the form's own checks or the server, shown after the field's own. */
    errors?: readonly string[]
    required?: boolean
    disabled?: boolean
  }>(),
  {
    mode: 'decimal',
    optional: false,
    description: undefined,
    placeholder: undefined,
    errors: () => [],
    required: false,
    disabled: false,
  },
)
const emit = defineEmits<{
  'update:modelValue': [value: number | null]
  /** Whether the typed text is a valid entry. */
  'update:valid': [valid: boolean]
}>()

const { t, locale } = useI18n()
const appLocale = computed(() => (isAppLocale(locale.value) ? locale.value : DEFAULT_LOCALE))

function display(value: number | null): string {
  if (value === null) return ''
  return props.mode === 'decimal'
    ? formatEditableNumber(fromTenths(value), appLocale.value)
    : formatEditableNumber(value, appLocale.value, 0)
}

function parse(
  value: string,
): { ok: true; value: number | null } | { ok: false; reason: NumberParseReason } {
  if (props.mode === 'decimal') {
    const result = parseLocaleDecimal(value, appLocale.value, { optional: props.optional })
    return result.ok ? { ok: true, value: result.tenths } : result
  }
  const result = parseLocaleInteger(value, { optional: props.optional })
  return result.ok ? { ok: true, value: result.value } : result
}

const text = ref(display(props.modelValue))
const reason = ref<NumberParseReason | null>(null)

// A value set from outside (a reload, "discard", a conflict) replaces the text unless the text
// already means that value.
watch(
  () => props.modelValue,
  (value) => {
    const current = parse(text.value)
    if (current.ok && current.value === value) return
    text.value = display(value)
    reason.value = null
  },
)
// The language changed: the stored value is shown with the new separator.
watch(appLocale, () => {
  if (reason.value === null) text.value = display(props.modelValue)
})

function onInput(event: Event) {
  text.value = (event.target as HTMLInputElement).value
  const result = parse(text.value)
  if (result.ok) {
    reason.value = null
    emit('update:valid', true)
    if (result.value !== props.modelValue) emit('update:modelValue', result.value)
  } else {
    reason.value = result.reason
    emit('update:valid', false)
  }
}

const ownError = computed(() => {
  switch (reason.value) {
    case 'notANumber':
      return lt('danger.object_is_not_numeric', text.value.trim())
    case 'tooManyDecimals':
      return t('validation.notMultipleOf', { factor: formatNumber(0.1, appLocale.value) })
    case 'empty':
      return t('validation.required')
    default:
      return null
  }
})
const allErrors = computed(() => [...(ownError.value ? [ownError.value] : []), ...props.errors])
</script>

<template>
  <FormField
    :id="id"
    :label="label"
    :description="description"
    :errors="allErrors"
    :required="required"
  >
    <template v-if="$slots.label" #label><slot name="label" /></template>
    <template #default="control">
      <input
        v-bind="control"
        :value="text"
        type="text"
        :inputmode="mode === 'decimal' ? 'decimal' : 'numeric'"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        :placeholder="placeholder"
        :disabled="disabled"
        class="h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:disabled:bg-gray-800"
        @input="onInput"
      />
    </template>
  </FormField>
</template>
