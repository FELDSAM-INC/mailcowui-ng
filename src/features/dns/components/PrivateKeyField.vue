<script setup lang="ts">
// The private key of an import (research R11, FR-029, FR-076; legacy "Private key: (RSA PKCS#8)"):
// a text area that never spell checks, corrects, completes or capitalises, and a file chooser
// whose file is checked by size before it is read and forgotten afterwards. The UTF-8 size is
// checked against the server's limit as the user types. The text lives in the page's state only.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import { formatBytes, formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import FormField from '@/shared/components/FormField.vue'
import { buttonVariants } from '@/shared/ui/button'
import { utf8ByteLength } from '@/shared/validation/utf8'

const props = withDefaults(
  defineProps<{
    id: string
    modelValue: string
    maxBytes: number
    minBits: number
    maxBits: number
    errors?: readonly string[]
  }>(),
  { errors: () => [] },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t, locale } = useI18n()
const file = ref<HTMLInputElement | null>(null)
const fileError = ref<string | null>(null)

const tooLongMessage = () =>
  t('validation.tooLongBytes', {
    max: formatBytes(props.maxBytes, locale.value as AppLocale, { exact: true }),
  })
const sizeError = computed(() =>
  utf8ByteLength(props.modelValue) > props.maxBytes ? tooLongMessage() : null,
)
const shownErrors = computed(() => [
  ...(fileError.value ? [fileError.value] : []),
  ...(sizeError.value ? [sizeError.value] : []),
  ...props.errors,
])
const hint = computed(() =>
  t('dns.dkim.import.keyHint', {
    min: formatNumber(props.minBits, locale.value as AppLocale),
    max: formatNumber(props.maxBits, locale.value as AppLocale),
  }),
)

function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const chosen = input.files?.[0]
  fileError.value = null
  if (!chosen) return
  if (chosen.size > props.maxBytes) {
    fileError.value = tooLongMessage()
    input.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    emit('update:modelValue', typeof reader.result === 'string' ? reader.result : '')
    input.value = ''
  }
  reader.onerror = () => {
    input.value = ''
  }
  reader.readAsText(chosen)
}
</script>

<template>
  <FormField
    :id="id"
    v-slot="field"
    :label="lt('admin.private_key')"
    :description="hint"
    :errors="shownErrors"
  >
    <textarea
      v-bind="field"
      :value="modelValue"
      rows="10"
      autocomplete="off"
      autocapitalize="none"
      autocorrect="off"
      spellcheck="false"
      placeholder="-----BEGIN PRIVATE KEY-----"
      class="min-h-48 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
  </FormField>
  <div class="flex flex-wrap items-center gap-2">
    <label :class="buttonVariants({ variant: 'outline', class: 'cursor-pointer' })">
      {{ t('dns.dkim.import.chooseFile') }}
      <input
        ref="file"
        type="file"
        accept=".pem,.key,.txt,text/plain"
        class="sr-only"
        @change="onFile"
      />
    </label>
  </div>
</template>
