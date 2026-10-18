<script setup lang="ts">
// The shared mailbox picker (UI 003, owned here and used by UI 004 and UI 008): a search-as-you-type
// picker over `listMailboxes`, single or multiple, with an optional domain filter, the search `q`
// and pages of 25 with "load more". It is UI 004's `DomainPicker` with a mailbox source, so the
// combobox, keyboard, chips and states are the same everywhere: each option shows the readable
// address (the domain in Unicode) and the ASCII address below it when it differs. The value is the
// ASCII address, as the API names mailboxes. Results are cached under `['mailboxes', 'search', …]`,
// so mailbox changes refresh them.
import { computed } from 'vue'

import { api, queryKeys, requireData, type MailboxListParams } from '@/api'

import DomainPicker, { type DomainPickerOption, type DomainPickerSource } from './DomainPicker.vue'

const props = withDefaults(
  defineProps<{
    id: string
    label: string
    modelValue: string | null | readonly string[]
    multiple?: boolean
    /** Only mailboxes of these domains (ASCII or readable names). */
    domain?: string | readonly string[]
    placeholder?: string
    description?: string
    errors?: readonly string[]
    required?: boolean
    /** Why a mailbox cannot be chosen (by its ASCII address), or null when it can. */
    disabledReason?: (address: string) => string | null
    /** Readable addresses already known for chosen values (ASCII → readable). */
    labels?: Readonly<Record<string, string>>
  }>(),
  {
    multiple: false,
    domain: undefined,
    placeholder: undefined,
    description: undefined,
    errors: undefined,
    required: false,
    disabledReason: undefined,
    labels: () => ({}),
  },
)
const emit = defineEmits<{
  'update:modelValue': [value: string | null | string[]]
  /** A chosen mailbox: its ASCII and readable address. */
  pick: [mailbox: { address: string; addressUnicode: string }]
}>()

const domains = computed(() =>
  props.domain === undefined
    ? []
    : Array.isArray(props.domain)
      ? [...props.domain]
      : [props.domain],
)

function params(q: string, offset: number, limit: number): MailboxListParams {
  return {
    limit,
    offset,
    sort: 'address',
    order: 'asc',
    ...(q ? { q } : {}),
    ...(domains.value.length > 0 ? { domain: domains.value } : {}),
  }
}

const source: DomainPickerSource = {
  id: 'mailboxes',
  queryKey: (q) => queryKeys.mailboxes.search(params(q, 0, 0)),
  async fetchPage({ q, offset, limit }) {
    const page = requireData(
      await api.GET('/mailboxes', { params: { query: params(q, offset, limit) } }),
    )
    return {
      items: page.data.map((mailbox) => ({
        name: mailbox.address,
        nameUnicode: `${mailbox.localPart}@${mailbox.domainUnicode}`,
      })),
      total: page.meta.total,
    }
  },
}

const reason = computed(() =>
  props.disabledReason
    ? (option: DomainPickerOption) => props.disabledReason!(option.name)
    : undefined,
)
</script>

<template>
  <DomainPicker
    :id="id"
    :label="label"
    :sources="[source]"
    :model-value="modelValue"
    :multiple="multiple"
    :placeholder="placeholder"
    :description="description"
    :errors="errors"
    :required="required"
    :disabled-reason="reason"
    :labels="labels"
    @update:model-value="emit('update:modelValue', $event)"
    @pick="emit('pick', { address: $event.name, addressUnicode: $event.nameUnicode })"
  />
</template>
