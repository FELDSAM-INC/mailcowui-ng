<script setup lang="ts">
// The alias list's filters (FR-011, FR-013), an improvement over the classic table's single domain
// select: domain (domains and alias domains, searched by the server), primary domain, kind,
// destination type, delivers to (a mailbox), active, allowed to send, SOGo visible (only with the
// groupware) and internal. Labels are the attributes' legacy keys. The panel names the number of
// active filters and clears them all.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { aliasDestinationTypeValues, aliasKindValues } from '@/api'
import { lt, type LegacyKey } from '@/i18n'
import DomainPicker, { type DomainPickerOption } from '@/shared/components/DomainPicker.vue'
import MailboxSearchPicker from '@/shared/components/MailboxSearchPicker.vue'
import MessageText from '@/shared/components/MessageText.vue'
import { FilterIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { aliasDomainPickerSource, domainPickerSource } from '@/features/aliases-common'
import type { AliasListFilters } from '../list-state'

const props = defineProps<{
  filters: AliasListFilters
  activeCount: number
  groupwareEnabled: boolean | undefined
  labels: Readonly<Record<string, string>>
}>()
const emit = defineEmits<{
  update: [change: Partial<AliasListFilters>]
  clear: []
  pick: [option: DomainPickerOption]
}>()
const { t } = useI18n()
const open = ref(props.activeCount > 0)

const domainSources = [
  domainPickerSource(lt('mailbox.domains')),
  aliasDomainPickerSource(lt('mailbox.domain_aliases')),
]
const primarySources = [domainPickerSource()]

const title = computed(() =>
  props.activeCount > 0
    ? t('lists.filters.withCount', { count: props.activeCount })
    : t('lists.filters.title'),
)

type FlagKey = 'active' | 'senderAllowed' | 'groupwareVisible' | 'internal'
const FLAGS = computed<{ key: FlagKey; label: LegacyKey }[]>(() => [
  { key: 'active', label: 'mailbox.active' },
  { key: 'senderAllowed', label: 'edit.sender_allowed' },
  ...(props.groupwareEnabled
    ? [{ key: 'groupwareVisible' as const, label: 'mailbox.sogo_visible' as LegacyKey }]
    : []),
  { key: 'internal', label: 'mailbox.internal' },
])

function toggle<K extends 'kind' | 'destinationType'>(
  key: K,
  value: AliasListFilters[K][number],
  checked: boolean,
) {
  const current = props.filters[key] as string[]
  const next = checked ? [...current, value] : current.filter((item) => item !== value)
  emit('update', { [key]: next } as Partial<AliasListFilters>)
}

function onFlag(key: FlagKey, event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('update', { [key]: value === '' ? undefined : value } as Partial<AliasListFilters>)
}

const SELECT =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white'
</script>

<template>
  <div class="flex flex-col gap-3">
    <button
      type="button"
      :class="
        buttonVariants({ variant: activeCount > 0 ? 'default' : 'outline', class: 'self-start' })
      "
      :aria-expanded="open ? 'true' : 'false'"
      aria-controls="alias-filters"
      @click="open = !open"
    >
      <FilterIcon />
      {{ title }}
    </button>
    <div
      v-show="open"
      id="alias-filters"
      class="grid grid-cols-1 gap-4 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-3 dark:border-gray-800 dark:bg-gray-900"
    >
      <DomainPicker
        id="alias-filter-domain"
        :label="lt('mailbox.domain')"
        :placeholder="lt('mailbox.all_domains')"
        :sources="domainSources"
        :model-value="filters.domain"
        :labels="labels"
        multiple
        @pick="emit('pick', $event)"
        @update:model-value="emit('update', { domain: ($event as string[]) ?? [] })"
      />
      <DomainPicker
        id="alias-filter-primary-domain"
        :label="lt('mailbox.target_domain')"
        :placeholder="lt('mailbox.all_domains')"
        :sources="primarySources"
        :model-value="filters.primaryDomain"
        :labels="labels"
        multiple
        @pick="emit('pick', $event)"
        @update:model-value="emit('update', { primaryDomain: ($event as string[]) ?? [] })"
      />
      <MailboxSearchPicker
        id="alias-filter-destination"
        :label="lt('mailbox.target_address')"
        :model-value="filters.destination ?? null"
        :labels="labels"
        @update:model-value="
          emit('update', { destination: ($event as string | null) ?? undefined })
        "
      />
      <fieldset class="flex min-w-0 flex-col gap-1.5">
        <legend class="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
          {{ lt('mailbox.kind') }}
        </legend>
        <label
          v-for="kind in aliasKindValues"
          :key="kind"
          class="inline-flex min-h-11 items-center gap-3 text-gray-800 dark:text-gray-200"
        >
          <input
            type="checkbox"
            class="size-5 accent-brand-500"
            :checked="filters.kind.includes(kind)"
            @change="toggle('kind', kind, ($event.target as HTMLInputElement).checked)"
          />
          <MessageText :k="`enums.aliasKind.${kind}`" />
        </label>
      </fieldset>
      <fieldset class="flex min-w-0 flex-col gap-1.5">
        <legend class="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
          {{ t('aliases.filters.destinationType') }}
        </legend>
        <label
          v-for="type in aliasDestinationTypeValues"
          :key="type"
          class="inline-flex min-h-11 items-center gap-3 text-gray-800 dark:text-gray-200"
        >
          <input
            type="checkbox"
            class="size-5 accent-brand-500"
            :checked="filters.destinationType.includes(type)"
            @change="toggle('destinationType', type, ($event.target as HTMLInputElement).checked)"
          />
          <MessageText :k="`enums.aliasDestinationType.${type}`" />
        </label>
      </fieldset>
      <div class="grid grid-cols-2 gap-4">
        <div v-for="flag in FLAGS" :key="flag.key" class="flex min-w-0 flex-col gap-1.5">
          <label
            :for="`alias-filter-${flag.key}`"
            class="text-sm font-medium text-gray-800 dark:text-gray-200"
          >
            {{ lt(flag.label) }}
          </label>
          <select
            :id="`alias-filter-${flag.key}`"
            :value="filters[flag.key] ?? ''"
            :class="SELECT"
            @change="onFlag(flag.key, $event)"
          >
            <option value="">{{ t('lists.filters.all') }}</option>
            <option value="true">{{ t('lists.filters.yes') }}</option>
            <option value="false">{{ t('lists.filters.no') }}</option>
          </select>
        </div>
      </div>
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline', class: 'self-start md:col-span-full' })"
        :disabled="activeCount === 0"
        @click="emit('clear')"
      >
        {{ t('lists.filters.clear') }}
      </button>
    </div>
  </div>
</template>
