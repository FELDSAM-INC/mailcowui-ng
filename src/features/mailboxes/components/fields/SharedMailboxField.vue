<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import FormField from '@/shared/components/FormField.vue'
defineProps<{ id: string; modelValue: boolean; errors?: readonly string[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const { t } = useI18n()
</script>
<template>
  <FormField
    :id="id"
    :label="t('mailboxes.shared.label')"
    :description="t('mailboxes.shared.help')"
    :errors="errors"
    ><template #default="control"
      ><input
        v-bind="control"
        type="checkbox"
        role="switch"
        :checked="modelValue"
        class="size-5 accent-accent"
        @change="
          emit('update:modelValue', ($event.target as HTMLInputElement).checked)
        " /></template
  ></FormField>
</template>
