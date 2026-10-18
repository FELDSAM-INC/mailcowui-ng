<script setup lang="ts">
// The identity provider select of the classic edit form (`admin.iam`): the built-in source named
// by the product (from the branding configuration, as the fork's template hard-codes its product
// name), and the sources the capabilities allow plus the mailbox's own (FR-024).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MailboxAuthSource, MailboxCapabilities } from '@/api'
import { useBranding } from '@/app/branding/public-config'
import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'

import { authSourceLabelKey, authSourceOptions } from '../../auth-source'

const props = withDefaults(
  defineProps<{
    id: string
    modelValue: MailboxAuthSource
    capabilities?: Pick<MailboxCapabilities, 'authSources'>
    current?: MailboxAuthSource
    errors?: readonly string[]
  }>(),
  { capabilities: undefined, current: undefined, errors: () => [] },
)
const emit = defineEmits<{ 'update:modelValue': [value: MailboxAuthSource] }>()
const { t } = useI18n()
const { branding } = useBranding()
const options = computed(() => authSourceOptions(props.capabilities, props.current))
const label = (source: MailboxAuthSource) => {
  const key = authSourceLabelKey(source)
  return key ? t(key) : branding.value.productName
}
</script>

<template>
  <FormField :id="id" :label="lt('admin.iam')" :errors="errors">
    <template #default="control">
      <select
        v-bind="control"
        :value="modelValue"
        class="form-control"
        @change="
          emit('update:modelValue', ($event.target as HTMLSelectElement).value as MailboxAuthSource)
        "
      >
        <option v-for="source in options" :key="source" :value="source">{{ label(source) }}</option>
      </select>
    </template>
  </FormField>
</template>
