<script setup lang="ts">
// The relayhost choice of the domain and mailbox sections (legacy form map part 1b): legacy's
// `edit.relayhost` select with live search (`data-live-search`), here UI 004's server-searched
// picker over `GET /relayhost-choices`, paged by 25. Options read as legacy's
// `ID n: host (username)`; inactive ones carry `admin.inactive` in text instead of legacy's red
// background; "None / Inherit" comes first (decision 11). The mailbox section adds legacy's
// `edit.mailbox_relayhost_info`.
import { computed } from 'vue'

import { queryKeys } from '@/api'
import { lt, type LegacyKey } from '@/i18n'
import DomainPicker, {
  type DomainPickerOption,
  type DomainPickerSource,
} from '@/shared/components/DomainPicker.vue'
import LegacyText from '@/shared/components/LegacyText.vue'

import { fetchRelayhostChoices } from '../../api/relayhost-assignments'
import {
  relayhostLabel,
  type RelayhostAssignmentState,
} from '../../composables/useRelayhostAssignment'

const props = withDefaults(
  defineProps<{ id: string; field: RelayhostAssignmentState; hint?: LegacyKey | null }>(),
  { hint: null },
)

const NONE = 'none'

const source: DomainPickerSource = {
  id: 'relayhosts',
  queryKey: (q) => queryKeys.relayhostChoices.search(q),
  async fetchPage({ q, offset, limit }) {
    const page = await fetchRelayhostChoices({ q, offset, limit })
    const items: DomainPickerOption[] = page.data.map((choice) => ({
      name: String(choice.id),
      nameUnicode: relayhostLabel(choice),
      detail: choice.active ? null : lt('admin.inactive'),
    }))
    const none = lt('edit.none_inherit')
    const offerNone = offset === 0 && (!q || none.toLowerCase().includes(q.toLowerCase()))
    return {
      items: offerNone ? [{ name: NONE, nameUnicode: none, detail: null }, ...items] : items,
      total: page.meta.total + (offerNone ? 1 : 0),
    }
  },
}

const value = computed(() =>
  props.field.selected.value === null ? NONE : String(props.field.selected.value),
)
const labels = computed(() => ({ [NONE]: lt('edit.none_inherit'), ...props.field.labels.value }))

function update(next: string | null | string[]) {
  const chosen = Array.isArray(next) ? next[0] : next
  props.field.choose(!chosen || chosen === NONE ? null : Number(chosen))
}
</script>

<template>
  <div class="flex flex-col gap-1.5" data-relayhost-field>
    <DomainPicker
      :id="id"
      :label="lt('edit.relayhost')"
      :sources="[source]"
      :model-value="value"
      :labels="labels"
      :errors="field.errors.value"
      @update:model-value="update"
      @pick="(option) => field.remember(option.name, option.nameUnicode)"
    />
    <LegacyText v-if="hint" :k="hint" as="p" class="text-sm text-gray-600 dark:text-gray-400" />
  </div>
</template>
