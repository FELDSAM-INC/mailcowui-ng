<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import FormField from '@/shared/components/FormField.vue'
import { utf8ByteLength } from '@/shared/validation/utf8'
const props = withDefaults(
  defineProps<{ id?: string; modelValue: string; maxBytes: number; errors?: readonly string[] }>(),
  { id: 'filter-script', errors: undefined },
)
defineEmits<{ 'update:modelValue': [value: string] }>()
const { t, n } = useI18n()
const used = computed(() => utf8ByteLength(props.modelValue))
</script>
<template>
  <FormField :id="id" :label="t('filters.form.script')" :errors="errors" required>
    <template #default="control">
      <textarea
        v-bind="control"
        :value="modelValue"
        rows="14"
        wrap="off"
        autocapitalize="none"
        autocorrect="off"
        :spellcheck="false"
        class="form-control w-full min-w-0 overflow-auto font-mono"
        @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      />
    </template>
  </FormField>
  <p data-script-bytes class="text-sm text-gray-600 dark:text-gray-400">
    {{ t('filters.form.bytes', { used: n(used), max: n(maxBytes) }) }}
  </p>
</template>
