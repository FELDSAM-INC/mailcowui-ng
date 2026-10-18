<script setup lang="ts">
// The DKIM key of a new domain or alias domain as the classic add forms ask for it (owner rule
// 1:1): the selector, prefilled by the caller (emptied, no key is generated), and the key length.
// Promoted from UI 002's domain fields at its second use (UI 004 research D13): the parent owns
// the values, and the key sizes come from its capabilities.
import { lt } from '@/i18n'

import FormField from './FormField.vue'

withDefaults(
  defineProps<{
    idPrefix: string
    selector: string
    keySize: number
    keySizes: readonly number[]
    selectorErrors?: readonly string[]
    keySizeErrors?: readonly string[]
  }>(),
  { selectorErrors: () => [], keySizeErrors: () => [] },
)
const emit = defineEmits<{
  'update:selector': [value: string]
  'update:keySize': [value: number]
}>()
</script>

<template>
  <div class="flex flex-col gap-4">
    <FormField
      :id="`${idPrefix}-dkimSelector`"
      :label="lt('admin.dkim_domains_selector')"
      :errors="selectorErrors"
    >
      <template #default="control">
        <input
          v-bind="control"
          :value="selector"
          type="text"
          autocomplete="off"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          class="form-control"
          @input="emit('update:selector', ($event.target as HTMLInputElement).value)"
        />
      </template>
    </FormField>
    <FormField
      :id="`${idPrefix}-dkimKeySize`"
      :label="lt('admin.dkim_key_length')"
      :errors="keySizeErrors"
    >
      <template #default="control">
        <select
          v-bind="control"
          :value="keySize"
          class="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          @change="emit('update:keySize', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="size in keySizes" :key="size" :value="size">{{ size }}</option>
        </select>
      </template>
    </FormField>
  </div>
</template>
