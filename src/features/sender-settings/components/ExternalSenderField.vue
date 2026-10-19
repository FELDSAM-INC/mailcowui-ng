<script setup lang="ts">
// "External sender addresses" (`edit.extended_sender_acl`), the classic page's comma-separated
// text field with its placeholder and `edit.extended_sender_acl_info`; shown only with
// `extendSenderAcl`, as legacy's `data-acl`. Entries the server refuses are named with legacy's
// message (`danger.extra_acl_invalid`, `danger.extra_acl_invalid_domain`).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import { parseEntryList } from '@/shared/validation/entry-list'

import { EXTERNAL_SENDERS_ID, type SenderSettingsState } from '../useSenderSettings'

const props = defineProps<{ state: SenderSettingsState }>()
const { t } = useI18n()
const value = computed(() => props.state.copy.value?.externalText ?? '')
const errors = computed(() => {
  const entries = parseEntryList(value.value)
  const own = props.state.problems.errorsFor('externalSenderAddresses')
  const byEntry = Object.entries(props.state.externalEntryErrors.value).flatMap(([index, list]) =>
    list.map((message) => `${entries[Number(index)]?.value ?? ''}: ${message}`),
  )
  return [...own, ...byEntry]
})
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1.5">
    <FormField :id="EXTERNAL_SENDERS_ID" :label="lt('edit.extended_sender_acl')" :errors="errors">
      <template #default="control">
        <input
          v-bind="control"
          :value="value"
          type="text"
          autocomplete="off"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          :placeholder="t('senderSettings.externalPlaceholder')"
          class="form-control"
          :aria-describedby="
            [control['aria-describedby'], `${EXTERNAL_SENDERS_ID}-info`].filter(Boolean).join(' ')
          "
          @input="state.setExternalText(($event.target as HTMLInputElement).value)"
        />
      </template>
    </FormField>
    <LegacyText
      :id="`${EXTERNAL_SENDERS_ID}-info`"
      k="edit.extended_sender_acl_info"
      as="p"
      class="text-sm text-gray-600 dark:text-gray-400"
    />
  </div>
</template>
