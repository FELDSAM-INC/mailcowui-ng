<script setup lang="ts">
// The target domain of the classic alias domain forms (`add.target_domain` with the placeholder
// `add.select`, `edit.target_domain`): a server-searched picker over the caller's domains. Relay
// (backup MX) domains are offered disabled with legacy's reason `danger.targetd_relay_domain`
// (US4-AS6).
import type { LegacyKey } from '@/i18n'
import { lt } from '@/i18n'
import DomainPicker, { type DomainPickerOption } from '@/shared/components/DomainPicker.vue'
import { domainPickerSource } from '@/features/aliases-common'

withDefaults(
  defineProps<{
    id: string
    labelKey: LegacyKey
    modelValue: string | null
    errors?: readonly string[]
    labels?: Readonly<Record<string, string>>
  }>(),
  { errors: () => [], labels: () => ({}) },
)
const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  pick: [option: DomainPickerOption]
}>()

const sources = [domainPickerSource()]
const disabledReason = (option: DomainPickerOption) =>
  option.relay ? lt('danger.targetd_relay_domain', option.name) : null
</script>

<template>
  <DomainPicker
    :id="id"
    :label="lt(labelKey)"
    :placeholder="lt('add.select')"
    :sources="sources"
    :model-value="modelValue"
    :errors="errors"
    :labels="labels"
    :disabled-reason="disabledReason"
    @pick="emit('pick', $event)"
    @update:model-value="emit('update:modelValue', ($event as string | null) ?? null)"
  />
</template>
