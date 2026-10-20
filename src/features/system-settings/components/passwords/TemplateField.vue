<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import FormField from '@/shared/components/FormField.vue'
import { buttonVariants } from '@/shared/ui/button'
import { templateBytes } from '../../lib/password-reset'

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
const format = useFormat()
const open = ref(false)
const wraps = ref(true)
const bytes = computed(() => templateBytes(value.value))
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
        >{{ t('systemSettings.passwordReset.defaultTemplate') }}</span
      >
    </summary>
    <div class="mt-3 min-w-0 space-y-3">
      <FormField
        :id="id"
        :label="label"
        :errors="errors"
        :description="lt('admin.restore_template')"
      >
        <template #default="control">
          <textarea
            v-bind="control"
            v-model="value"
            :readonly="readonly"
            :disabled="disabled"
            rows="12"
            :wrap="wraps ? 'soft' : 'off'"
            spellcheck="false"
            autocapitalize="none"
            autocorrect="off"
            class="min-h-48 w-full min-w-0 max-w-full resize-y rounded-lg border border-gray-300 bg-transparent p-3 font-mono text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-600 dark:text-white"
          />
        </template>
      </FormField>
      <p
        v-if="bytes >= maxBytes * 0.9"
        role="status"
        class="text-sm text-gray-600 dark:text-gray-400"
      >
        {{
          t('systemSettings.passwordReset.size', {
            size: format.bytes(bytes),
            max: format.bytes(maxBytes),
          })
        }}
      </p>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <label class="flex min-h-11 items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
          ><input v-model="wraps" type="checkbox" class="size-5 accent-brand-600" />{{
            t('systemSettings.passwordReset.wrapLines')
          }}</label
        >
        <button
          v-if="html"
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          @click="$emit('preview')"
        >
          {{ t('systemSettings.passwordReset.preview') }}
        </button>
      </div>
    </div>
  </details>
</template>
