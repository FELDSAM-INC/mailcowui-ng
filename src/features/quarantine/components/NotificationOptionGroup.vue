<script setup lang="ts">
// One of legacy's two notification option groups (legacy form map screen 3): the legend, the
// options in legacy order as radio buttons, and legacy's help below. A member the caller may not
// change shows its stored value as text with "Prohibited by ACL" and the permission (D12: no other
// note). No option is checked when nothing is stored (D4).
import { computed } from 'vue'

import { lt } from '@/i18n'
import AclReadOnlyNote from '@/shared/components/AclReadOnlyNote.vue'
import LegacyText from '@/shared/components/LegacyText.vue'

import {
  CATEGORY_OPTIONS,
  FREQUENCY_OPTIONS,
  NOTIFICATION_FIELD_INFO,
  notificationValueLabel,
  type NotificationField,
} from '../composables/useNotificationEditor'

const props = withDefaults(
  defineProps<{
    idPrefix: string
    field: NotificationField
    modelValue: string | null
    readonly?: boolean
    errors?: readonly string[]
  }>(),
  { readonly: false, errors: () => [] },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const info = computed(() => NOTIFICATION_FIELD_INFO[props.field])
const options = computed(() => (props.field === 'frequency' ? FREQUENCY_OPTIONS : CATEGORY_OPTIONS))
const groupId = computed(() => `${props.idPrefix}-${props.field}`)
const describedBy = computed(() =>
  [
    `${groupId.value}-help`,
    props.readonly ? `${groupId.value}-acl` : null,
    props.errors.length > 0 ? `${groupId.value}-error` : null,
  ]
    .filter(Boolean)
    .join(' '),
)
</script>

<template>
  <fieldset
    :id="groupId"
    :data-notification-field="field"
    tabindex="-1"
    class="flex min-w-0 flex-col gap-2"
    :aria-describedby="describedBy"
    :aria-invalid="errors.length > 0 ? 'true' : undefined"
  >
    <legend class="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
      {{ lt(info.labelKey) }}
    </legend>
    <template v-if="readonly">
      <p :data-value="field" class="text-sm text-gray-900 dark:text-white">
        {{ notificationValueLabel(field, modelValue) }}
      </p>
      <AclReadOnlyNote :id="`${groupId}-acl`" :flag="info.flag" />
    </template>
    <div v-else class="flex flex-wrap gap-2">
      <label
        v-for="option in options"
        :key="option.value"
        class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm text-gray-800 has-checked:border-brand-500 has-checked:bg-brand-50 has-checked:text-brand-800 dark:border-gray-700 dark:text-gray-200 dark:has-checked:bg-brand-500/15 dark:has-checked:text-brand-200"
      >
        <input
          :id="`${groupId}-${option.value}`"
          type="radio"
          :name="groupId"
          :value="option.value"
          :checked="modelValue === option.value"
          class="size-4 accent-accent"
          @change="emit('update:modelValue', option.value)"
        />
        {{ lt(option.labelKey) }}
      </label>
    </div>
    <div
      v-if="errors.length > 0"
      :id="`${groupId}-error`"
      class="text-sm text-red-700 dark:text-red-300"
    >
      <p v-for="(message, index) in errors" :key="index" class="break-words">{{ message }}</p>
    </div>
    <LegacyText
      :id="`${groupId}-help`"
      :k="info.helpKey"
      as="p"
      class="text-sm text-gray-600 dark:text-gray-400"
    />
  </fieldset>
</template>
