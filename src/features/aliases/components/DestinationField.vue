<script setup lang="ts">
// The goto part of the classic alias forms (`#addAliasModal`, `edit/alias.twig`, `js/site/mailbox.js`
// and `edit.js`): the goto textarea with its help, and legacy's three mutually exclusive checkboxes
// "Silently discard mail", "Learn as spam" and "Learn as ham"; a checked box disables the textarea,
// which keeps its text, so unchecking restores it (docs/conventions.md, legacy's goto options).
// Server errors on `destinations.N` are shown on the entry they name. When external destinations
// are restricted, an advance notice says so (FR-020).
import { useI18n } from 'vue-i18n'

import type { LegacyKey } from '@/i18n'
import EntryListField from '@/shared/components/EntryListField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import { InfoIcon } from '@/shared/icons'

import type { GotoAction } from '../alias-form'

const props = withDefaults(
  defineProps<{
    id: string
    destinationsText: string
    gotoAction: GotoAction
    /** `add.target_address` on the add form, `edit.target_address` on the edit form. */
    labelKey: LegacyKey
    /** `add.target_address_info` on the add form; the edit form has none. */
    helpKey?: LegacyKey
    restricted?: boolean
    errors?: readonly string[]
    entryErrors?: Readonly<Record<number, readonly string[]>>
  }>(),
  { helpKey: undefined, restricted: false, errors: () => [], entryErrors: () => ({}) },
)
const emit = defineEmits<{
  'update:destinationsText': [value: string]
  'update:gotoAction': [value: GotoAction]
}>()
const { t } = useI18n()

const ACTIONS: { value: Exclude<GotoAction, 'none'>; key: LegacyKey }[] = [
  { value: 'discard', key: 'add.goto_null' },
  { value: 'learnSpam', key: 'add.goto_spam' },
  { value: 'learnHam', key: 'add.goto_ham' },
]

function onAction(value: Exclude<GotoAction, 'none'>, checked: boolean) {
  if (checked) emit('update:gotoAction', value)
  else if (props.gotoAction === value) emit('update:gotoAction', 'none')
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-3">
    <EntryListField
      :id="id"
      :model-value="destinationsText"
      :disabled="gotoAction !== 'none'"
      :errors="errors"
      :entry-errors="entryErrors"
      @update:model-value="emit('update:destinationsText', $event)"
    >
      <template #label><LegacyText :k="labelKey" /></template>
      <template v-if="helpKey" #help><LegacyText :k="helpKey" /></template>
    </EntryListField>
    <p
      v-if="restricted"
      data-external-notice
      class="flex gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100"
    >
      <InfoIcon class="mt-0.5 size-4 shrink-0" />
      <span>{{ t('aliases.form.externalNotice') }}</span>
    </p>
    <div class="flex flex-col">
      <label
        v-for="action in ACTIONS"
        :key="action.value"
        class="inline-flex min-h-11 items-center gap-3 text-gray-800 dark:text-gray-200"
      >
        <input
          type="checkbox"
          class="size-5 accent-brand-500"
          :checked="gotoAction === action.value"
          @change="onAction(action.value, ($event.target as HTMLInputElement).checked)"
        />
        <LegacyText :k="action.key" />
      </label>
    </div>
  </div>
</template>
