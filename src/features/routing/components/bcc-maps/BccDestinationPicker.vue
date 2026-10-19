<script setup lang="ts">
// The local destination of a BCC map (research R14; `addBCCModalAdmin`'s live-search select,
// legacy form map part 1b): UI 004's server-searched picker over `GET /bcc-destination-choices`,
// paged by 25, grouped as legacy groups the options (`mailbox.domains`, `mailbox.domain_aliases`,
// then the mailboxes with their aliases); the mailboxes an alias delivers to are the option's
// second line, where legacy names the mailbox as the group's label.
import { queryKeys, type BccDestinationChoiceKind } from '@/api'
import { lt } from '@/i18n'
import DomainPicker, { type DomainPickerSource } from '@/shared/components/DomainPicker.vue'

import { fetchBccDestinationChoices } from '../../api/bcc-maps'

defineProps<{ id: string; modelValue: string | null; errors?: readonly string[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

function source(id: string, label: string, kinds: BccDestinationChoiceKind[]): DomainPickerSource {
  return {
    id,
    label,
    queryKey: (q) => queryKeys.bccDestinationChoices.search({ q, kind: kinds }),
    async fetchPage({ q, offset, limit }) {
      const page = await fetchBccDestinationChoices({
        ...(q ? { q } : {}),
        kind: kinds,
        offset,
        limit,
      })
      return {
        items: page.data.map((choice) => ({
          name: choice.value,
          nameUnicode: choice.value,
          detail: choice.deliversTo.length > 0 ? choice.deliversTo.join(', ') : null,
        })),
        total: page.meta.total,
      }
    },
  }
}

const SOURCES = [
  source('domains', lt('mailbox.domains'), ['domain']),
  source('aliasDomains', lt('mailbox.domain_aliases'), ['aliasDomain']),
  source('mailboxes', lt('mailbox.mailboxes'), ['mailbox', 'alias', 'aliasDomainAddress']),
]
</script>

<template>
  <DomainPicker
    :id="id"
    :label="lt('mailbox.bcc_local_dest')"
    :sources="SOURCES"
    :model-value="modelValue"
    :errors="errors"
    @update:model-value="(value) => emit('update:modelValue', (value as string | null) ?? null)"
  />
</template>
