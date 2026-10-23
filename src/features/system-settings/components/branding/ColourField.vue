<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { adjust, foreground, normalizeHex } from '@/shared/color/contrast'
import FormField from '@/shared/components/FormField.vue'
import ContrastReport from './ContrastReport.vue'
const props = defineProps<{
  id: string
  label: string
  modelValue: string | null
  surface: string
  minimum: number
  disabled?: boolean
  errors?: readonly string[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()
const { t } = useI18n()
const normalized = computed(() => normalizeHex(props.modelValue ?? ''))
const invalid = computed(() => !!props.modelValue && !normalized.value)
const textColour = computed(() => normalized.value && foreground(normalized.value))
const linkColour = computed(
  () => normalized.value && adjust(normalized.value, props.surface, props.minimum),
)
const errors = computed(() => [
  ...(props.errors ?? []),
  ...(invalid.value ? [t('systemSettings.colours.format')] : []),
])
function input(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value || null)
}
function normalize(event: FocusEvent) {
  const colour = normalizeHex((event.target as HTMLInputElement).value)
  if (colour) emit('update:modelValue', colour)
}
</script>
<template>
  <div class="space-y-2">
    <FormField
      :id="id"
      :label="label"
      :errors="errors"
      :description="t('systemSettings.colours.format')"
    >
      <template #default="control">
        <div class="flex min-w-0 items-center gap-2">
          <input
            v-bind="control"
            :value="modelValue ?? ''"
            type="text"
            inputmode="text"
            autocapitalize="off"
            autocorrect="off"
            :spellcheck="false"
            autocomplete="off"
            :disabled="disabled"
            class="form-control flex-1"
            @input="input"
            @blur="normalize"
          />
          <input
            :id="`${id}-picker`"
            type="color"
            :value="normalized ?? '#000000'"
            :aria-label="t('systemSettings.colours.picker', { theme: label })"
            :disabled="disabled"
            class="size-11 shrink-0 cursor-pointer rounded-lg border border-gray-300 bg-white p-1 dark:border-gray-600 dark:bg-gray-900"
            @input="input"
          />
        </div>
      </template>
    </FormField>
    <ContrastReport
      v-if="normalized && textColour"
      :colour="textColour"
      :surface="normalized"
      :minimum="minimum"
    />
    <p v-if="linkColour && linkColour !== normalized" class="text-sm text-muted">
      {{ t('systemSettings.colours.linkAdjusted', { colour: linkColour }) }}
    </p>
  </div>
</template>
