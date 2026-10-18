<script setup lang="ts">
// The relay options as the classic forms show them (owner rule 1:1): three checkboxes under
// "Relay options", the note after "Relay all recipients" and the closing note about transport maps.
// As in legacy, each checkbox is independent; the API normalises the combination when it saves, and
// the saved values are shown afterwards. The add domain form uses the `add.*` keys, the edit
// forms the `edit.*` keys.
import { lt, type LegacyKey } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'

import type { RelayOption, RelayOptions } from '../../relay'

export interface RelayLabels {
  legend: LegacyKey
  backupMx: LegacyKey
  relayAllRecipients: LegacyKey
  /** With markup, as legacy has it. */
  relayAllInfo: LegacyKey
  relayUnknownOnly: LegacyKey
  /** With markup (legacy's "Info" badge). */
  transportInfo: LegacyKey
}

const props = withDefaults(
  defineProps<{
    idPrefix: string
    modelValue: RelayOptions
    labels?: RelayLabels
    errors?: readonly string[]
  }>(),
  {
    labels: () => ({
      legend: 'edit.backup_mx_options',
      backupMx: 'edit.relay_domain',
      relayAllRecipients: 'edit.relay_all',
      relayAllInfo: 'edit.relay_all_info',
      relayUnknownOnly: 'edit.relay_unknown_only',
      transportInfo: 'edit.relay_transport_info',
    }),
    errors: () => [],
  },
)
const emit = defineEmits<{ 'update:modelValue': [value: RelayOptions] }>()

function onChange(option: RelayOption, event: Event) {
  emit('update:modelValue', {
    ...props.modelValue,
    [option]: (event.target as HTMLInputElement).checked,
  })
}
const OPTIONS: RelayOption[] = ['backupMx', 'relayAllRecipients', 'relayUnknownOnly']
</script>

<template>
  <fieldset class="flex min-w-0 flex-col gap-2">
    <legend class="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
      {{ lt(labels.legend) }}
    </legend>
    <div v-for="option in OPTIONS" :key="option" class="flex flex-col">
      <label
        class="flex min-h-11 cursor-pointer items-center gap-3 text-gray-800 dark:text-gray-200"
      >
        <input
          :id="`${idPrefix}-${option}`"
          type="checkbox"
          class="size-5 shrink-0 accent-brand-500"
          :checked="modelValue[option]"
          :aria-describedby="
            option === 'relayAllRecipients' ? `${idPrefix}-relayAll-info` : undefined
          "
          @change="onChange(option, $event)"
        />
        <span class="break-words">{{ lt(labels[option]) }}</span>
      </label>
      <LegacyText
        v-if="option === 'relayAllRecipients'"
        :id="`${idPrefix}-relayAll-info`"
        :k="labels.relayAllInfo"
        as="p"
        class="ms-8 text-sm text-gray-600 dark:text-gray-400"
      />
    </div>
    <LegacyText
      :k="labels.transportInfo"
      as="div"
      data-transport-info
      class="text-sm text-gray-600 dark:text-gray-400"
    />
    <div v-if="errors.length > 0" class="text-sm text-red-700 dark:text-red-300">
      <p v-for="(message, index) in errors" :key="index">{{ message }}</p>
    </div>
  </fieldset>
</template>
