<script setup lang="ts">
// The domain values of the classic add domain, add template and edit template forms (owner rule
// 1:1): the same fields, labels, help texts, order and groups (separated where legacy has `<hr>`).
// The template forms start with the template name; the add domain form puts its domain,
// description and template choice in the `lead` slot instead and leaves out the Global Address
// List when the groupware is disabled, as legacy does. The Default template's name is read-only.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DomainCapabilities } from '@/api'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import { TEMPLATE_NAME_MAX_LENGTH } from '@/shared/validation/limits'

import { useTagSuggestions } from '../../composables/useTagSuggestions'
import {
  formLabel,
  formLabelKeys,
  galInfoKey,
  relayLabels,
  type ValueForm,
} from '../../form-labels'
import type { DomainValues } from '../../create-form'
import DkimFields from '@/shared/components/DkimFields.vue'
import LegacyRateLimitField from '@/shared/components/LegacyRateLimitField.vue'
import LimitField from './LimitField.vue'
import RelayOptionsField from './RelayOptionsField.vue'
import TagSetInput from '@/shared/components/TagSetInput.vue'

type Values = DomainValues & { name?: string }

const props = withDefaults(
  defineProps<{
    idPrefix: string
    form: ValueForm
    modelValue: Values
    capabilities: DomainCapabilities
    errorsFor: (path: string) => readonly string[]
    nameReadonly?: boolean
  }>(),
  { nameReadonly: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: Values] }>()
const { t } = useI18n()
const suggestions = useTagSuggestions()
const labels = computed(() => formLabelKeys(props.form))
const label = (field: string) => formLabel(props.form, field)
const withName = computed(() => props.form !== 'domainAdd')
const showGal = computed(() => props.form !== 'domainAdd' || props.capabilities.groupwareEnabled)
const keySizes = computed(
  () => props.capabilities.dkim?.allowedKeySizes ?? [1024, 2048, 3072, 4096],
)

function update<K extends keyof Values>(key: K, value: Values[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

const tagChipErrors = computed(() => {
  const chips: Record<number, readonly string[]> = {}
  props.modelValue.tags.forEach((_, index) => {
    const messages = props.errorsFor(`tags.${index}`)
    if (messages.length > 0) chips[index] = messages
  })
  return chips
})

const INPUT =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-500 read-only:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:read-only:bg-gray-950'
const GROUP =
  'flex min-w-0 flex-col gap-4 border-t border-gray-200 pt-4 first:border-t-0 first:pt-0 dark:border-gray-800'
const LIMITS = ['maxAliases', 'maxMailboxes', 'maxMailboxQuota', 'domainQuota'] as const
</script>

<template>
  <div class="flex flex-col gap-4">
    <div :class="GROUP">
      <slot name="lead" />
      <FormField
        v-if="withName"
        :id="`${idPrefix}-name`"
        :label="label('name')"
        :description="nameReadonly ? t('domainTemplates.edit.defaultName') : undefined"
        required
        :errors="errorsFor('name')"
      >
        <template #default="control">
          <input
            v-bind="control"
            :value="modelValue.name"
            type="text"
            autocomplete="off"
            :readonly="nameReadonly"
            :maxlength="TEMPLATE_NAME_MAX_LENGTH"
            :class="INPUT"
            @input="update('name', ($event.target as HTMLInputElement).value)"
          />
        </template>
      </FormField>
      <TagSetInput
        :id="`${idPrefix}-tags`"
        :label="label('tags')"
        :model-value="modelValue.tags"
        :max-length="capabilities.maxTagLength"
        :errors="errorsFor('tags')"
        :chip-errors="tagChipErrors"
        :suggestions="suggestions.suggestions.value"
        :suggestions-state="suggestions.state.value"
        @search="suggestions.search"
        @update:model-value="update('tags', $event)"
      />
      <LimitField
        v-for="field in LIMITS"
        :id="`${idPrefix}-${field}`"
        :key="field"
        :label="label(field)"
        :model-value="modelValue[field]"
        :errors="errorsFor(field)"
        @update:model-value="update(field, $event)"
      />
      <div v-if="showGal" class="flex flex-col">
        <label
          class="flex min-h-11 cursor-pointer items-center gap-3 text-gray-800 dark:text-gray-200"
        >
          <input
            :id="`${idPrefix}-gal`"
            type="checkbox"
            class="size-5 shrink-0 accent-brand-500"
            :checked="modelValue.globalAddressList"
            :aria-describedby="`${idPrefix}-gal-help`"
            @change="update('globalAddressList', ($event.target as HTMLInputElement).checked)"
          />
          <span>{{ label('globalAddressList') }}</span>
        </label>
        <LegacyText
          :id="`${idPrefix}-gal-help`"
          :k="galInfoKey(form)"
          as="p"
          class="ms-8 text-sm text-gray-600 dark:text-gray-400"
        />
      </div>
      <label
        class="flex min-h-11 cursor-pointer items-center gap-3 text-gray-800 dark:text-gray-200"
      >
        <input
          :id="`${idPrefix}-active`"
          type="checkbox"
          class="size-5 shrink-0 accent-brand-500"
          :checked="modelValue.active"
          @change="update('active', ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ label('active') }}</span>
      </label>
    </div>

    <div :class="GROUP">
      <LegacyRateLimitField
        :id-prefix="`${idPrefix}-rateLimit`"
        :label-key="labels.rateLimit"
        :value="modelValue.rateLimitValue"
        :frame="modelValue.rateLimitFrame"
        :errors="errorsFor('rateLimit.value')"
        @update:value="update('rateLimitValue', $event)"
        @update:frame="update('rateLimitFrame', $event)"
      />
    </div>

    <div :class="GROUP">
      <DkimFields
        :id-prefix="idPrefix"
        :selector="modelValue.dkimSelector"
        :key-size="modelValue.dkimKeySize"
        :key-sizes="keySizes"
        :selector-errors="errorsFor('dkimSelector')"
        :key-size-errors="errorsFor('dkimKeySize')"
        @update:selector="update('dkimSelector', $event)"
        @update:key-size="update('dkimKeySize', $event)"
      />
    </div>

    <div :class="GROUP">
      <RelayOptionsField
        :id-prefix="`${idPrefix}-relay`"
        :labels="relayLabels(form)"
        :model-value="modelValue.relay"
        @update:model-value="update('relay', $event)"
      />
    </div>
  </div>
</template>
