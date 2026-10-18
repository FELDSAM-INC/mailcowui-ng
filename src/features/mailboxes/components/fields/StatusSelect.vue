<script setup lang="ts">
// The status select of the classic forms (`active`: active, login disallowed, inactive). Legacy
// gives it no visible label; its accessible name is legacy's "Status" (`mailbox.status`), read only
// by assistive technology, so the form looks as legacy's.
import type { MailboxStatus } from '@/api'
import { lt } from '@/i18n'

import { STATUS_KEYS } from './options'

withDefaults(
  defineProps<{
    id: string
    modelValue: MailboxStatus
    keys?: 'add' | 'edit'
    disabled?: boolean
  }>(),
  { keys: 'edit', disabled: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: MailboxStatus] }>()
const VALUES: MailboxStatus[] = ['active', 'loginDisabled', 'inactive']
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label :for="id" class="sr-only">{{ lt('mailbox.status') }}</label>
    <select
      :id="id"
      :value="modelValue"
      :disabled="disabled"
      class="form-control"
      @change="
        emit('update:modelValue', ($event.target as HTMLSelectElement).value as MailboxStatus)
      "
    >
      <option v-for="value in VALUES" :key="value" :value="value">
        {{ lt(STATUS_KEYS[keys][value]) }}
      </option>
    </select>
  </div>
</template>
