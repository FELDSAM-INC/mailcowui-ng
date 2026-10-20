<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AppLinkSettingsEntry } from '@/api'
import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import { appLinkPreview } from '../../lib/app-link-url'
const props = withDefaults(
  defineProps<{
    modelValue: AppLinkSettingsEntry
    index: number
    username: string
    disabled?: boolean
    errorsFor?: (path: string) => readonly string[]
  }>(),
  { disabled: false, errorsFor: () => [] },
)
const emit = defineEmits<{
  'update:modelValue': [value: AppLinkSettingsEntry]
  invalidPaste: [path: string]
  input: []
}>()
const { t } = useI18n()
const labels = {
  name: 'admin.app_name',
  url: 'admin.link',
  signedInUrl: 'admin.user_link',
} as const
const preview = computed(() => appLinkPreview(props.modelValue, props.username))
function update(field: keyof AppLinkSettingsEntry, event: Event) {
  const input = event.target as HTMLInputElement
  emit('update:modelValue', {
    ...props.modelValue,
    [field]:
      field === 'showOnLoginPage'
        ? !input.checked
        : field === 'signedInUrl'
          ? input.value || null
          : input.value,
  })
  emit('input')
}
function paste(event: ClipboardEvent, field: string) {
  if (/[\u0000-\u001f\u007f]/.test(event.clipboardData?.getData('text') ?? '')) {
    event.preventDefault()
    emit('invalidPaste', `links.${props.index}.${field}`)
  }
}
</script>
<template>
  <div class="grid min-w-0 gap-4 lg:grid-cols-3">
    <FormField
      v-for="field in ['name', 'url', 'signedInUrl'] as const"
      :id="`app-link-${index}-${field}`"
      :key="field"
      :label="lt(labels[field])"
      :required="field !== 'signedInUrl'"
      :errors="errorsFor(`links.${index}.${field}`)"
      :description="field === 'signedInUrl' ? t('systemSettings.appLinks.sameAsLink') : undefined"
    >
      <template #default="control"
        ><input
          v-bind="control"
          :value="modelValue[field] ?? ''"
          type="text"
          :disabled="disabled"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          class="min-h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-600 dark:text-white"
          @input="update(field, $event)"
          @paste="paste($event, field)"
      /></template>
    </FormField>
    <label class="flex min-h-11 items-center gap-3 lg:col-span-3"
      ><input
        :id="`app-link-${index}-showOnLoginPage`"
        type="checkbox"
        :checked="!modelValue.showOnLoginPage"
        :disabled="disabled"
        class="size-5 shrink-0 accent-brand-600"
        @change="update('showOnLoginPage', $event)"
      />{{ lt('admin.app_hide') }}</label
    >
    <p class="min-w-0 wrap-anywhere text-sm lg:col-span-3" data-link-preview>
      {{ t('systemSettings.appLinks.preview', { username }) }}
      <span>{{ preview ?? t('systemSettings.appLinks.previewInvalid') }}</span>
    </p>
  </div>
</template>
