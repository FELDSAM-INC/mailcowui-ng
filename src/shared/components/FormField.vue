<script setup lang="ts">
// A labelled form field (FR-076, FR-080, research R21). The control is rendered by the default
// slot, which receives the attributes to bind: id, aria-invalid and aria-describedby.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  id: string
  label: string
  description?: string
  errors?: readonly string[]
  required?: boolean
}>()

const { t } = useI18n()
const invalid = computed(() => (props.errors?.length ?? 0) > 0)
const descriptionId = computed(() => `${props.id}-description`)
const errorId = computed(() => `${props.id}-error`)
const control = computed(() => {
  const describedBy = [
    props.description ? descriptionId.value : null,
    invalid.value ? errorId.value : null,
  ]
    .filter(Boolean)
    .join(' ')
  return {
    id: props.id,
    'aria-invalid': invalid.value ? ('true' as const) : undefined,
    'aria-describedby': describedBy || undefined,
    'aria-required': props.required ? ('true' as const) : undefined,
  }
})
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label :for="id" class="text-sm font-medium text-gray-800 dark:text-gray-200">
      {{ label }}
      <span v-if="required" class="font-normal text-gray-600 dark:text-gray-400">
        ({{ t('forms.required') }})
      </span>
    </label>
    <p v-if="description" :id="descriptionId" class="text-sm text-gray-600 dark:text-gray-400">
      {{ description }}
    </p>
    <slot v-bind="control" />
    <div v-if="invalid" :id="errorId" class="text-sm text-red-700 dark:text-red-300">
      <p v-for="(message, index) in errors" :key="index" class="break-words">
        <span class="sr-only">{{ `${t('a11y.errorPrefix')} ` }}</span
        >{{ message }}
      </p>
    </div>
  </div>
</template>
