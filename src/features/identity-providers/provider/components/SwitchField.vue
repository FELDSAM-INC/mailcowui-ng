<script setup lang="ts">
// One switch of the classic identity provider form (a checkbox, as legacy's form-switch), with
// legacy's label and, where legacy has one, its help text (markup through the sanitiser).
import LegacyText from '@/shared/components/LegacyText.vue'
import type { LegacyKey } from '@/i18n'

defineProps<{ id: string; label: string; modelValue: boolean; help?: LegacyKey }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <div class="flex flex-col">
    <label class="flex min-h-11 cursor-pointer items-center gap-3 text-gray-800 dark:text-gray-200">
      <input
        :id="id"
        :checked="modelValue"
        type="checkbox"
        role="switch"
        class="size-5 shrink-0 accent-accent"
        :aria-describedby="help ? `${id}-help` : undefined"
        @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      />
      <span>{{ label }}</span>
    </label>
    <LegacyText
      v-if="help"
      :id="`${id}-help`"
      :k="help"
      as="p"
      class="ms-8 text-sm text-gray-600 dark:text-gray-400 [&_code]:font-mono"
    />
  </div>
</template>
