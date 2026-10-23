<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'

// A multi-entry field (UI 004 research R8): alias addresses, goto addresses, alias domain names and
// external sender addresses, as the classic forms' textareas take them (separated by commas,
// semicolons, spaces or new lines). The label and help text are the caller's, often legacy texts
// with markup (slots `label` and `help`). Below the field:
// - the entries the caller marks (`marker`, for example "Catch-All" for `@domain`);
// - server errors on the entry with the index the API names (`destinations.2`), linked to the field.
// Read-only mode shows the entries as text. Long entries wrap.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { parseEntryList } from '../validation/entry-list'

const props = withDefaults(
  defineProps<{
    id: string
    label?: string
    modelValue: string
    rows?: number
    readonly?: boolean
    disabled?: boolean
    required?: boolean
    /** Errors of the field as a whole. */
    errors?: readonly string[]
    /** Errors per entry, by the entry's index in the list sent. */
    entryErrors?: Readonly<Record<number, readonly string[]>>
    /** A short marker for an entry, or null. */
    marker?: (value: string) => string | null
    placeholder?: string
    inputmode?: 'text' | 'email' | 'url'
  }>(),
  {
    label: undefined,
    rows: 5,
    readonly: false,
    disabled: false,
    required: false,
    errors: () => [],
    entryErrors: () => ({}),
    marker: undefined,
    placeholder: undefined,
    inputmode: undefined,
  },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useI18n()
const slots = defineSlots<{ label?: () => unknown; help?: () => unknown }>()

const entries = computed(() => parseEntryList(props.modelValue))
const marked = computed(() =>
  props.marker
    ? entries.value.flatMap((entry) => {
        const text = props.marker!(entry.value)
        return text ? [{ ...entry, text }] : []
      })
    : [],
)
const withErrors = computed(() =>
  entries.value.flatMap((entry) => {
    const messages = props.entryErrors[entry.index] ?? []
    return messages.length > 0 ? [{ ...entry, messages }] : []
  }),
)
const invalid = computed(() => props.errors.length > 0 || withErrors.value.length > 0)
const describedBy = computed(
  () =>
    [
      slots.help ? `${props.id}-help` : null,
      props.errors.length > 0 ? `${props.id}-error` : null,
      withErrors.value.length > 0 ? `${props.id}-entries` : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined,
)
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1.5">
    <component
      :is="readonly ? 'p' : 'label'"
      :id="`${id}-label`"
      :for="readonly ? undefined : id"
      class="text-sm font-medium text-gray-800 dark:text-gray-200"
    >
      <slot name="label">{{ label }}</slot>
      <span v-if="required && !readonly" class="font-normal text-gray-600 dark:text-gray-400">
        ({{ t('forms.required') }})
      </span>
    </component>
    <ul
      v-if="readonly"
      :aria-labelledby="`${id}-label`"
      class="flex flex-col gap-1 text-gray-900 dark:text-white"
    >
      <li v-for="entry in entries" :key="entry.index" class="break-all">{{ entry.value }}</li>
    </ul>
    <textarea
      v-else
      :id="id"
      :value="modelValue"
      :rows="rows"
      :disabled="disabled"
      :placeholder="placeholder"
      :inputmode="inputmode"
      autocapitalize="none"
      autocorrect="off"
      autocomplete="off"
      spellcheck="false"
      :aria-invalid="invalid ? 'true' : undefined"
      :aria-required="required ? 'true' : undefined"
      :aria-describedby="describedBy"
      class="min-h-28 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-600 aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:disabled:bg-gray-800 dark:disabled:text-gray-400"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <div v-if="slots.help" :id="`${id}-help`" class="text-sm text-gray-600 dark:text-gray-400">
      <slot name="help" />
    </div>
    <ul v-if="marked.length > 0 && !readonly" class="flex flex-col gap-1 text-sm">
      <li
        v-for="entry in marked"
        :key="entry.index"
        data-entry-marker
        class="flex min-w-0 flex-wrap items-center gap-2"
      >
        <Badge color="gray">{{ entry.text }}</Badge>
        <span class="min-w-0 break-all text-gray-800 dark:text-gray-200">{{ entry.value }}</span>
      </li>
    </ul>
    <div
      v-if="errors.length > 0"
      :id="`${id}-error`"
      class="text-sm text-red-700 dark:text-red-300"
    >
      <p v-for="(message, index) in errors" :key="index" class="break-words">
        <span class="sr-only">{{ `${t('a11y.errorPrefix')} ` }}</span
        >{{ message }}
      </p>
    </div>
    <ul
      v-if="withErrors.length > 0"
      :id="`${id}-entries`"
      class="flex flex-col gap-1 text-sm text-red-700 dark:text-red-300"
    >
      <li v-for="entry in withErrors" :key="entry.index" class="min-w-0 break-all">
        <span class="sr-only">{{ `${t('a11y.errorPrefix')} ` }}</span>
        <span class="font-medium">{{ entry.value }}</span>
        <span v-for="(message, index) in entry.messages" :key="index" class="block break-words">{{
          message
        }}</span>
      </li>
    </ul>
  </div>
</template>
