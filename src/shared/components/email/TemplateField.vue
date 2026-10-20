<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { lt } from '@/i18n'
import CodeEditor from '@/shared/components/code-editor/CodeEditor.vue'
import { buttonVariants } from '@/shared/ui/button'

const props = withDefaults(
  defineProps<{
    id: string
    label: string
    maxBytes: number
    errors?: readonly string[]
    disabled?: boolean
    readonly?: boolean
    defaultTemplate?: boolean
    html?: boolean
  }>(),
  { errors: () => [], disabled: false, readonly: false, defaultTemplate: false, html: false },
)
const value = defineModel<string>({ required: true })
defineEmits<{ preview: [] }>()
const { t } = useI18n()
const open = ref(false)
watch(
  () => props.errors.length,
  (count) => {
    if (count) open.value = true
  },
  { flush: 'sync' },
)
</script>

<template>
  <details
    :open="open"
    class="min-w-0 rounded-xl border border-gray-200 p-3 dark:border-gray-700"
    @toggle="open = ($event.target as HTMLDetailsElement).open"
  >
    <summary
      class="min-h-11 cursor-pointer content-center text-sm font-medium text-gray-800 dark:text-gray-200"
    >
      {{ label }}
      <span
        v-if="defaultTemplate"
        data-default-template
        class="ms-2 rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800"
        >{{ t('emailTemplate.defaultTemplate') }}</span
      >
    </summary>
    <div class="mt-3 min-w-0 space-y-3">
      <CodeEditor
        :id="id"
        v-model="value"
        :label="label"
        :max-bytes="maxBytes"
        :errors="errors"
        :disabled="disabled"
        :readonly="readonly"
        :line-numbers="false"
      />
      <p class="text-sm text-gray-600 dark:text-gray-400">{{ lt('admin.restore_template') }}</p>
      <div class="flex flex-wrap items-center justify-end gap-3">
        <button
          v-if="html"
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          @click="$emit('preview')"
        >
          {{ t('emailTemplate.preview') }}
        </button>
      </div>
    </div>
  </details>
</template>
